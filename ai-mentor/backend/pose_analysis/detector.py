"""MediaPipe Pose Landmarker (Tasks API) wrapper, model download, and skeleton drawing."""

from __future__ import annotations

import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Sequence

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

MODELS_DIR = Path(__file__).resolve().parent / "models"

# Official model assets listed at
# https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models
_MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker"
MODEL_URLS = {
    "lite": f"{_MODEL_BASE}/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    "full": f"{_MODEL_BASE}/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    "heavy": f"{_MODEL_BASE}/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
}
DEFAULT_MODEL = "lite"
# Real model files are several MB; anything tiny is an error page or a truncated download.
_MIN_MODEL_BYTES = 1_000_000

# Landmarks below this visibility (likely occluded / out of frame) are not drawn.
DEFAULT_VISIBILITY_THRESHOLD = 0.5

POSE_CONNECTIONS = [(c.start, c.end) for c in vision.PoseLandmarksConnections.POSE_LANDMARKS]


class ModelError(Exception):
    """The pose model could not be downloaded or initialized."""


def model_path(variant: str = DEFAULT_MODEL) -> Path:
    if variant not in MODEL_URLS:
        raise ModelError(f"Unknown model variant '{variant}'. Choose one of: {', '.join(MODEL_URLS)}.")
    return MODELS_DIR / f"pose_landmarker_{variant}.task"


def ensure_model(variant: str = DEFAULT_MODEL, timeout: float = 60.0) -> Path:
    """Return the local model path, downloading it once if it is not already present."""
    path = model_path(variant)
    if path.exists() and path.stat().st_size >= _MIN_MODEL_BYTES:
        return path

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".task.part")
    try:
        with urllib.request.urlopen(MODEL_URLS[variant], timeout=timeout) as response, open(tmp_path, "wb") as out:
            while chunk := response.read(1 << 16):
                out.write(chunk)
        if tmp_path.stat().st_size < _MIN_MODEL_BYTES:
            raise ModelError("The downloaded model file is unexpectedly small and may be corrupted.")
        os.replace(tmp_path, path)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ModelError(
            f"Could not download the MediaPipe pose model ({variant}). "
            f"Check your internet connection, or download it manually from "
            f"{MODEL_URLS[variant]} and save it as {path}. Details: {exc}"
        ) from exc
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
    return path


class PoseDetector:
    """Pose Landmarker in VIDEO running mode. Use as a context manager."""

    def __init__(
        self,
        variant: str = DEFAULT_MODEL,
        num_poses: int = 1,
        min_pose_detection_confidence: float = 0.5,
        min_pose_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ):
        path = ensure_model(variant)
        options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(path)),
            running_mode=vision.RunningMode.VIDEO,
            num_poses=num_poses,
            min_pose_detection_confidence=min_pose_detection_confidence,
            min_pose_presence_confidence=min_pose_presence_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )
        try:
            self._landmarker = vision.PoseLandmarker.create_from_options(options)
        except Exception as exc:  # noqa: BLE001 - MediaPipe raises various runtime errors
            raise ModelError(
                f"The MediaPipe pose model could not be initialized. "
                f"Try deleting {path} so it is downloaded again. Details: {exc}"
            ) from exc

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list:
        """Run detection on one BGR frame. Returns a list of poses (each a list of 33 landmarks)."""
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = self._landmarker.detect_for_video(image, timestamp_ms)
        return list(result.pose_landmarks or [])

    def close(self) -> None:
        self._landmarker.close()

    def __enter__(self) -> "PoseDetector":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def _visible_points(landmarks: Sequence, width: int, height: int, threshold: float) -> dict[int, tuple[int, int]]:
    """Pixel coordinates of landmarks that are confidently visible and inside the frame."""
    points = {}
    for idx, lm in enumerate(landmarks):
        visibility = getattr(lm, "visibility", None)
        if visibility is not None and visibility < threshold:
            continue
        if not (0.0 <= lm.x <= 1.0 and 0.0 <= lm.y <= 1.0):
            continue
        points[idx] = (int(round(lm.x * (width - 1))), int(round(lm.y * (height - 1))))
    return points


def draw_pose(
    frame_bgr: np.ndarray,
    landmarks: Sequence,
    visibility_threshold: float = DEFAULT_VISIBILITY_THRESHOLD,
) -> int:
    """Draw one detected pose in-place. Returns the number of landmarks drawn.

    Only landmarks MediaPipe reports as visible are drawn, and a bone is drawn only
    when both of its endpoints are visible - nothing is interpolated or invented.
    """
    height, width = frame_bgr.shape[:2]
    scale = max(1.0, min(width, height) / 480.0)
    line_thickness = max(2, int(round(2 * scale)))
    radius = max(3, int(round(3 * scale)))

    points = _visible_points(landmarks, width, height, visibility_threshold)
    for start, end in POSE_CONNECTIONS:
        if start in points and end in points:
            cv2.line(frame_bgr, points[start], points[end], (255, 255, 255), line_thickness, cv2.LINE_AA)
    for pt in points.values():
        cv2.circle(frame_bgr, pt, radius, (0, 200, 255), -1, cv2.LINE_AA)
        cv2.circle(frame_bgr, pt, radius, (0, 0, 0), 1, cv2.LINE_AA)
    return len(points)
