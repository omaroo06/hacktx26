"""Frame-by-frame pipeline: decode -> detect pose -> measure -> draw skeleton -> encode H.264 MP4."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

import cv2

from pose_analysis.detector import DEFAULT_MODEL, PoseDetector, draw_pose
from pose_analysis.technique_analysis import FrameMeasurement, measure_frame
from pose_analysis.video_utils import (
    CameraMotionEstimator,
    H264Writer,
    VideoEncodingError,
    VideoInfo,
    VideoValidationError,
    frame_timestamp_ms,
    landmark_bounding_box,
    probe_video,
)

# Called with (frames_processed, estimated_total_frames).
ProgressCallback = Callable[[int, int], None]


@dataclass(frozen=True)
class ProcessingResult:
    video_info: VideoInfo
    frames_processed: int
    frames_with_pose: int
    processing_seconds: float
    # One entry per frame, recorded from the same detections used for drawing.
    measurements: list[FrameMeasurement] = field(default_factory=list)

    @property
    def detection_rate(self) -> float:
        return self.frames_with_pose / self.frames_processed if self.frames_processed else 0.0

    @property
    def pose_detected(self) -> bool:
        return self.frames_with_pose > 0


def process_video(
    input_path: str | os.PathLike,
    output_path: str | os.PathLike,
    model_variant: str = DEFAULT_MODEL,
    progress_callback: Optional[ProgressCallback] = None,
) -> ProcessingResult:
    """Annotate every frame of `input_path` with detected pose landmarks and write `output_path`.

    Raises VideoValidationError, ModelError, or VideoEncodingError on failure.
    """
    info = probe_video(input_path)
    start_time = time.perf_counter()
    frames_processed = 0
    frames_with_pose = 0
    previous_ts = None
    measurements: list[FrameMeasurement] = []
    camera_motion = CameraMotionEstimator()

    # Load the model before starting the encoder so model errors surface first.
    with PoseDetector(variant=model_variant) as detector:
        cap = cv2.VideoCapture(str(input_path))
        if not cap.isOpened():
            raise VideoValidationError("The video could not be opened for processing.")
        writer = H264Writer(output_path, info.width, info.height, info.fps)
        try:
            while True:
                ok, frame = cap.read()
                if not ok or frame is None:
                    break

                timestamp = frame_timestamp_ms(frames_processed, info.fps, previous_ts)
                previous_ts = timestamp

                poses = detector.detect(frame, timestamp)
                # Exclude the climber so the camera estimate reflects only the wall.
                camera_shift = camera_motion.update(frame, landmark_bounding_box(poses[0]) if poses else None)
                height, width = frame.shape[:2]
                measurements.append(measure_frame(
                    frames_processed, timestamp / 1000.0, poses[0] if poses else None,
                    width, height, camera_shift,
                ))
                if poses:
                    frames_with_pose += 1
                    for landmarks in poses:
                        draw_pose(frame, landmarks)
                # Frames without a detection are written unchanged.
                writer.write(frame)
                frames_processed += 1

                if progress_callback:
                    progress_callback(frames_processed, max(info.frame_count, frames_processed))
            writer.close()
        except BaseException:
            writer.abort()
            raise
        finally:
            cap.release()

    if frames_processed == 0:
        raise VideoValidationError("No frames could be decoded from the video.")
    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise VideoEncodingError("The encoder did not produce an output video.")

    return ProcessingResult(
        video_info=info,
        frames_processed=frames_processed,
        frames_with_pose=frames_with_pose,
        processing_seconds=time.perf_counter() - start_time,
        measurements=measurements,
    )
