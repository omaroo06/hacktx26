"""Video helpers: input validation, timestamps, and browser-compatible H.264 output."""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2
import imageio_ffmpeg
import numpy as np

DEFAULT_FPS = 30.0
# Anything outside this range is treated as broken container metadata.
MIN_VALID_FPS = 1.0
MAX_VALID_FPS = 240.0

ALLOWED_EXTENSIONS = {".mp4"}


class VideoValidationError(Exception):
    """The input video is missing, empty, unsupported, or cannot be decoded."""


class VideoEncodingError(Exception):
    """Writing the output MP4 failed."""


@dataclass(frozen=True)
class VideoInfo:
    width: int
    height: int
    fps: float
    fps_is_fallback: bool
    # Container-reported frame count; may be approximate or 0 when unknown.
    frame_count: int


def check_extension(filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise VideoValidationError(
            f"Unsupported file type '{ext or 'none'}'. Please upload an MP4 video."
        )


def resolve_fps(reported_fps: float | None) -> tuple[float, bool]:
    """Return (fps, is_fallback). Falls back to DEFAULT_FPS for missing/implausible values."""
    try:
        fps = float(reported_fps) if reported_fps is not None else 0.0
    except (TypeError, ValueError):
        fps = 0.0
    if not np.isfinite(fps) or not (MIN_VALID_FPS <= fps <= MAX_VALID_FPS):
        return DEFAULT_FPS, True
    return fps, False


def frame_timestamp_ms(frame_index: int, fps: float, previous_ms: int | None) -> int:
    """Timestamp (ms) of a frame on the video timeline, forced to be strictly increasing.

    MediaPipe VIDEO mode rejects timestamps that are not monotonically increasing,
    which rounding at high frame rates could otherwise produce.
    """
    ts = int(round(frame_index * 1000.0 / fps))
    if previous_ms is not None and ts <= previous_ms:
        ts = previous_ms + 1
    return ts


def probe_video(path: str | os.PathLike) -> VideoInfo:
    """Validate that OpenCV can open and decode the video, and read its properties."""
    path = Path(path)
    if not path.exists():
        raise VideoValidationError("The video file could not be found.")
    if path.stat().st_size == 0:
        raise VideoValidationError("The uploaded file is empty.")

    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise VideoValidationError(
                "The video could not be opened. It may be corrupted or use an unsupported codec."
            )
        ok, frame = cap.read()
        if not ok or frame is None:
            raise VideoValidationError(
                "No frames could be decoded from the video. It may be corrupted or use an unsupported codec."
            )
        # Use the decoded frame for dimensions: OpenCV applies phone rotation metadata
        # to frames, so container width/height can be swapped for portrait videos.
        height, width = frame.shape[:2]
        fps, fps_is_fallback = resolve_fps(cap.get(cv2.CAP_PROP_FPS))
        frame_count = max(int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0), 0)
    finally:
        cap.release()

    return VideoInfo(width, height, fps, fps_is_fallback, frame_count)


class H264Writer:
    """Pipes raw BGR frames into the bundled FFmpeg binary to produce an H.264 MP4.

    Output uses yuv420p and +faststart so it plays in browsers (and st.video).
    Audio is not included.
    """

    def __init__(self, output_path: str | os.PathLike, width: int, height: int, fps: float):
        self.output_path = Path(output_path)
        self.width = width
        self.height = height
        try:
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception as exc:  # noqa: BLE001 - surface as a friendly error
            raise VideoEncodingError(f"The FFmpeg encoder could not be located: {exc}") from exc

        cmd = [
            ffmpeg, "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "bgr24",
            "-s", f"{width}x{height}", "-r", f"{fps:.6f}",
            "-i", "-",
            "-an",
            # yuv420p requires even dimensions; pad by at most 1px if needed.
            "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(self.output_path),
        ]
        # stderr goes to a file so a chatty encoder can never block the pipe.
        self._stderr = tempfile.TemporaryFile()
        try:
            self._proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=self._stderr,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        except OSError as exc:
            self._stderr.close()
            raise VideoEncodingError(f"Could not start the video encoder: {exc}") from exc

    def write(self, frame_bgr: np.ndarray) -> None:
        if frame_bgr.shape[:2] != (self.height, self.width):
            frame_bgr = cv2.resize(frame_bgr, (self.width, self.height))
        try:
            self._proc.stdin.write(np.ascontiguousarray(frame_bgr, dtype=np.uint8).tobytes())
        except (BrokenPipeError, OSError) as exc:
            raise VideoEncodingError(f"The video encoder stopped unexpectedly. {self._error_text()}") from exc

    def close(self) -> None:
        """Finish encoding. Raises VideoEncodingError if FFmpeg failed."""
        try:
            if self._proc.stdin and not self._proc.stdin.closed:
                try:
                    self._proc.stdin.close()
                except OSError:
                    pass
            code = self._proc.wait(timeout=300)
            if code != 0:
                raise VideoEncodingError(f"Video encoding failed (exit code {code}). {self._error_text()}")
        finally:
            self._stderr.close()

    def abort(self) -> None:
        try:
            if self._proc.poll() is None:
                self._proc.kill()
                self._proc.wait(timeout=10)
        finally:
            if not self._stderr.closed:
                self._stderr.close()

    def _error_text(self) -> str:
        try:
            self._stderr.seek(0)
            return self._stderr.read().decode("utf-8", "replace").strip()[-500:]
        except (OSError, ValueError):
            return ""


class CameraMotionEstimator:
    """Estimates how the background (climbing wall) moves in the image between frames.

    Tracks texture points with sparse Lucas-Kanade optical flow, excluding the climber's
    bounding box so a camera that follows the climber is still detected. The returned
    (dx, dy) is the median background flow in full-resolution pixels: a body that is
    stationary on the wall moves in the image by this same amount.
    Returns None when there is too little background texture or the flow is inconsistent.
    """

    def __init__(self, analysis_width: int = 320, min_points: int = 12, min_agreement: float = 0.5):
        self.analysis_width = analysis_width
        self.min_points = min_points
        self.min_agreement = min_agreement
        self._previous = None
        self._previous_box = None

    def update(
        self, frame_bgr: np.ndarray, exclude_box: tuple[float, float, float, float] | None = None
    ) -> tuple[float, float] | None:
        """Background shift since the previous frame; None for the first frame or when unreliable.

        `exclude_box` is (x0, y0, x1, y1) in normalized [0, 1] coordinates around the climber.
        """
        height, width = frame_bgr.shape[:2]
        scale = width / self.analysis_width if width > self.analysis_width else 1.0
        small_size = (max(16, int(round(width / scale))), max(16, int(round(height / scale))))
        gray = cv2.cvtColor(cv2.resize(frame_bgr, small_size, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)

        previous, previous_box = self._previous, self._previous_box
        self._previous, self._previous_box = gray, exclude_box
        if previous is None or previous.shape != gray.shape:
            return None

        mask = np.full(gray.shape, 255, dtype=np.uint8)
        for box in (previous_box, exclude_box):
            if box is not None:
                x0, y0, x1, y1 = box
                w, h = gray.shape[1], gray.shape[0]
                mask[max(0, int(y0 * h)):min(h, int(np.ceil(y1 * h))), max(0, int(x0 * w)):min(w, int(np.ceil(x1 * w)))] = 0

        points = cv2.goodFeaturesToTrack(previous, maxCorners=200, qualityLevel=0.01, minDistance=7, mask=mask)
        if points is None or len(points) < self.min_points:
            return None
        moved, status, _err = cv2.calcOpticalFlowPyrLK(previous, gray, points, None, winSize=(21, 21), maxLevel=3)
        if moved is None:
            return None
        ok = status.reshape(-1) == 1
        if ok.sum() < self.min_points:
            return None
        flow = (moved.reshape(-1, 2) - points.reshape(-1, 2))[ok]
        median = np.median(flow, axis=0)
        # Require most points to agree, otherwise the "background" is not moving as one.
        agreement = np.mean(np.linalg.norm(flow - median, axis=1) <= 1.0)
        if agreement < self.min_agreement:
            return None
        return float(median[0] * scale), float(median[1] * scale)


def landmark_bounding_box(landmarks, margin: float = 0.08) -> tuple[float, float, float, float] | None:
    """Normalized (x0, y0, x1, y1) box around all landmarks, padded by `margin` and clipped to the frame."""
    xs = [lm.x for lm in landmarks if np.isfinite(lm.x)]
    ys = [lm.y for lm in landmarks if np.isfinite(lm.y)]
    if not xs or not ys:
        return None
    return (
        max(0.0, min(xs) - margin), max(0.0, min(ys) - margin),
        min(1.0, max(xs) + margin), min(1.0, max(ys) + margin),
    )


@dataclass(frozen=True)
class StreamInfo:
    codec: str
    pix_fmt: str
    width: int
    height: int
    fps: float | None


def inspect_video_stream(path: str | os.PathLike) -> StreamInfo:
    """Read codec/pixel-format/size/fps of the first video stream using the bundled FFmpeg."""
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(path)],
        capture_output=True, text=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    match = re.search(r"Video:\s*(\w+)[^,]*,\s*(\w+)[^,]*,\s*(\d+)x(\d+)", proc.stderr)
    if not match:
        raise VideoEncodingError("Could not read a video stream from the output file.")
    fps_match = re.search(r"([\d.]+)\s*fps", proc.stderr)
    return StreamInfo(
        codec=match.group(1),
        pix_fmt=match.group(2),
        width=int(match.group(3)),
        height=int(match.group(4)),
        fps=float(fps_match.group(1)) if fps_match else None,
    )
