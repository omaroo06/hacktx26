from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from pose_analysis.detector import draw_pose
from pose_analysis.video_utils import (
    DEFAULT_FPS,
    CameraMotionEstimator,
    H264Writer,
    landmark_bounding_box,
    VideoValidationError,
    check_extension,
    frame_timestamp_ms,
    inspect_video_stream,
    probe_video,
    resolve_fps,
)


def make_mp4v_video(path, width=160, height=120, fps=24.0, frames=12):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    assert writer.isOpened()
    for i in range(frames):
        frame = np.full((height, width, 3), (i * 20) % 255, dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return path


# --- input validation -------------------------------------------------------

@pytest.mark.parametrize("name", ["climb.mp4", "CLIMB.MP4"])
def test_check_extension_accepts_mp4(name):
    check_extension(name)


@pytest.mark.parametrize("name", ["climb.mov", "climb.txt", "climb"])
def test_check_extension_rejects_other_types(name):
    with pytest.raises(VideoValidationError):
        check_extension(name)


def test_probe_rejects_missing_file(tmp_path):
    with pytest.raises(VideoValidationError):
        probe_video(tmp_path / "missing.mp4")


def test_probe_rejects_empty_file(tmp_path):
    path = tmp_path / "empty.mp4"
    path.write_bytes(b"")
    with pytest.raises(VideoValidationError, match="empty"):
        probe_video(path)


def test_probe_rejects_corrupted_file(tmp_path):
    path = tmp_path / "corrupt.mp4"
    path.write_bytes(b"this is not a video" * 1000)
    with pytest.raises(VideoValidationError):
        probe_video(path)


def test_probe_reads_valid_video(tmp_path):
    path = make_mp4v_video(tmp_path / "ok.mp4", width=160, height=120, fps=24.0, frames=12)
    info = probe_video(path)
    assert (info.width, info.height) == (160, 120)
    assert info.fps == pytest.approx(24.0, abs=0.1)
    assert not info.fps_is_fallback
    assert info.frame_count == 12


# --- FPS and timestamps -----------------------------------------------------

@pytest.mark.parametrize("bad", [None, 0, -5, float("nan"), float("inf"), 1000, "abc"])
def test_resolve_fps_falls_back(bad):
    assert resolve_fps(bad) == (DEFAULT_FPS, True)


def test_resolve_fps_keeps_valid_value():
    assert resolve_fps(29.97) == (29.97, False)


def test_timestamps_follow_timeline_and_increase():
    fps = 30.0
    previous = None
    stamps = []
    for i in range(100):
        previous = frame_timestamp_ms(i, fps, previous)
        stamps.append(previous)
    assert stamps[0] == 0
    assert stamps[30] == 1000
    assert all(b > a for a, b in zip(stamps, stamps[1:]))


def test_timestamps_strictly_increase_at_very_high_fps():
    previous = None
    stamps = []
    for i in range(50):
        previous = frame_timestamp_ms(i, 2000.0, previous)
        stamps.append(previous)
    assert all(b > a for a, b in zip(stamps, stamps[1:]))


# --- H.264 output -----------------------------------------------------------

@pytest.mark.parametrize("size", [(160, 120), (161, 121)])
def test_h264_writer_produces_browser_compatible_mp4(tmp_path, size):
    width, height = size
    out = tmp_path / "out.mp4"
    writer = H264Writer(out, width, height, fps=25.0)
    for i in range(25):
        writer.write(np.full((height, width, 3), i * 10, dtype=np.uint8))
    writer.close()

    stream = inspect_video_stream(out)
    assert stream.codec == "h264"
    assert stream.pix_fmt == "yuv420p"
    # Odd sizes are padded by 1px to satisfy yuv420p.
    assert (stream.width, stream.height) == (width + width % 2, height + height % 2)
    assert stream.fps == pytest.approx(25.0, abs=0.1)
    # +faststart puts the 'moov' atom before 'mdat' so browsers can start playback.
    data = out.read_bytes()
    assert data.index(b"moov") < data.index(b"mdat")
    # OpenCV can decode it back with the expected frame count.
    cap = cv2.VideoCapture(str(out))
    count = 0
    while cap.read()[0]:
        count += 1
    cap.release()
    assert count == 25


# --- camera motion -----------------------------------------------------------

def _textured_background(seed=0, size=(400, 300)):
    rng = np.random.default_rng(seed)
    noise = rng.integers(0, 255, (size[1] // 8, size[0] // 8), dtype=np.uint8)
    base = cv2.resize(noise, size, interpolation=cv2.INTER_NEAREST)
    return cv2.cvtColor(cv2.GaussianBlur(base, (5, 5), 0), cv2.COLOR_GRAY2BGR)


def _shifted(image, dx, dy):
    m = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(image, m, (image.shape[1], image.shape[0]), borderMode=cv2.BORDER_REFLECT)


def test_camera_motion_measures_background_shift_and_ignores_climber():
    background = _textured_background()
    person_box = (0.35, 0.2, 0.65, 0.9)
    estimator = CameraMotionEstimator()
    frame1 = background.copy()
    frame2 = _shifted(background, 0, 6)  # camera tilts: wall moves down 6 px
    # A "climber" that stays put in the image (camera following them) inside the excluded box.
    patch = _textured_background(seed=9, size=(120, 210))
    frame1[60:270, 140:260] = patch
    frame2[60:270, 140:260] = patch
    assert estimator.update(frame1, person_box) is None
    dx, dy = estimator.update(frame2, person_box)
    assert dx == pytest.approx(0, abs=0.5) and dy == pytest.approx(6, abs=0.5)


def test_camera_motion_is_unknown_without_texture():
    estimator = CameraMotionEstimator()
    blank = np.full((300, 400, 3), 128, dtype=np.uint8)
    estimator.update(blank)
    assert estimator.update(blank) is None


def test_landmark_bounding_box_is_padded_and_clipped():
    lms = [SimpleNamespace(x=0.02, y=0.5), SimpleNamespace(x=0.5, y=0.95)]
    assert landmark_bounding_box(lms, margin=0.1) == pytest.approx((0.0, 0.4, 0.6, 1.0))


# --- drawing ----------------------------------------------------------------

def _lm(x, y, visibility):
    return SimpleNamespace(x=x, y=y, visibility=visibility)


def test_draw_pose_skips_invisible_and_out_of_frame_landmarks():
    frame = np.zeros((200, 200, 3), dtype=np.uint8)
    landmarks = [_lm(0.5, 0.5, 0.0)] * 33  # all hidden
    landmarks[11] = _lm(0.3, 0.3, 0.9)  # left shoulder visible
    landmarks[12] = _lm(0.7, 0.3, 0.9)  # right shoulder visible
    landmarks[13] = _lm(1.5, 0.5, 0.9)  # visible score but outside the frame
    drawn = draw_pose(frame, landmarks)
    assert drawn == 2
    # Shoulder-to-shoulder bone drawn between the two visible points.
    assert frame[60, 100].any()


def test_draw_pose_draws_nothing_when_all_hidden():
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    assert draw_pose(frame, [_lm(0.5, 0.5, 0.1)] * 33) == 0
    assert not frame.any()
