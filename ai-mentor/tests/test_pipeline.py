"""Integration checks using the real MediaPipe model (downloaded on first run).

These use synthetic frames with no person in them, so they verify model loading,
VIDEO-mode timestamps, and honest "no pose" reporting - not real-world detection quality.
"""

import cv2
import numpy as np
import pytest

from pose_analysis.detector import PoseDetector, ensure_model
from pose_analysis.video_processor import process_video
from pose_analysis.video_utils import inspect_video_stream


@pytest.fixture(scope="module")
def model_available():
    try:
        return ensure_model()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Model unavailable (offline?): {exc}")


def test_model_loads_and_runs_in_video_mode(model_available):
    blank = np.zeros((240, 320, 3), dtype=np.uint8)
    with PoseDetector() as detector:
        for i in range(3):
            assert detector.detect(blank, i * 33) == []


def test_pipeline_reports_no_pose_on_empty_scene(tmp_path, model_available):
    src = tmp_path / "blank.mp4"
    writer = cv2.VideoWriter(str(src), cv2.VideoWriter_fourcc(*"mp4v"), 20.0, (320, 240))
    for i in range(20):
        writer.write(np.full((240, 320, 3), 40 + i, dtype=np.uint8))
    writer.release()

    out = tmp_path / "out.mp4"
    progress = []
    result = process_video(src, out, progress_callback=lambda d, t: progress.append((d, t)))

    assert result.frames_processed == 20
    assert result.frames_with_pose == 0
    assert not result.pose_detected
    assert progress[-1] == (20, 20)
    # Measurements are recorded for every frame from the same detections, with no invented angles.
    assert [m.frame_index for m in result.measurements] == list(range(20))
    assert result.measurements[10].timestamp_s == pytest.approx(0.5)
    assert not any(m.pose_detected or m.left.angle or m.right.angle for m in result.measurements)
    # Uniform frames have no texture to track, so camera motion is reported as unknown.
    assert all(m.camera_dx is None for m in result.measurements)
    stream = inspect_video_stream(out)
    assert (stream.codec, stream.width, stream.height) == ("h264", 320, 240)
    assert stream.fps == pytest.approx(20.0, abs=0.1)
