"""Elbow-angle measurement and sustained bent-arm detection.

All angles are 2D angles measured in image pixel coordinates: they are the projection
of the real 3D joint angle onto the camera plane, so they depend on the camera viewpoint
and are not exact anatomical measurements.

"Left" and "right" are the climber's own left and right, as labelled by MediaPipe.

Pipeline:
1. `measure_frame` turns one frame's MediaPipe landmarks into raw measurements
   (called once per frame during video processing; MediaPipe is never re-run).
2. `analyze` applies visibility thresholds, smoothing, stillness estimation and the
   rule-based bent-arm detector to the stored measurements.
"""

from __future__ import annotations

import csv
import io
import json
import math
from dataclasses import asdict, dataclass
from typing import Optional, Sequence

import numpy as np

LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
LEFT_ELBOW, RIGHT_ELBOW = 13, 14
LEFT_WRIST, RIGHT_WRIST = 15, 16
LEFT_HIP, RIGHT_HIP = 23, 24
LEFT_ANKLE, RIGHT_ANKLE = 27, 28

ARMS = ("left", "right")
ARM_LANDMARKS = {
    "left": (LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST),
    "right": (RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST),
}
TORSO_LANDMARKS = (LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP)
# Hands and feet: their motion relative to the torso reveals reaches and steps.
EXTREMITY_LANDMARKS = (LEFT_WRIST, RIGHT_WRIST, LEFT_ANKLE, RIGHT_ANKLE)
MOTION_LANDMARKS = TORSO_LANDMARKS + EXTREMITY_LANDMARKS

# Arm segments shorter than this (pixels) give meaningless angles.
_MIN_SEGMENT_PX = 2.0
_MIN_TORSO_PX = 5.0
# Below this fraction of frames with a valid elbow angle, results are flagged as unreliable.
MIN_COVERAGE_FOR_ANALYSIS = 0.2

ANGLE_DISCLAIMER = (
    "Elbow angles are 2D angles measured in the video image (shoulder–elbow–wrist), "
    "not exact 3D anatomical angles. They vary with camera viewpoint."
)


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #

def joint_angle(a: Sequence[float], b: Sequence[float], c: Sequence[float]) -> Optional[float]:
    """Angle ABC in degrees, with B as the vertex. Returns None for degenerate input."""
    a, b, c = (np.asarray(p, dtype=float) for p in (a, b, c))
    if not (np.all(np.isfinite(a)) and np.all(np.isfinite(b)) and np.all(np.isfinite(c))):
        return None
    ba, bc = a - b, c - b
    n1, n2 = np.linalg.norm(ba), np.linalg.norm(bc)
    if n1 < 1e-9 or n2 < 1e-9:
        return None
    cos_angle = np.clip(np.dot(ba, bc) / (n1 * n2), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_angle)))


def _landmark_px(landmark, width: int, height: int) -> tuple[Optional[np.ndarray], float]:
    """Pixel position (None if invalid/outside the frame) and visibility (0 if unknown)."""
    vis = getattr(landmark, "visibility", None)
    visibility = float(vis) if vis is not None and math.isfinite(vis) else 0.0
    x, y = getattr(landmark, "x", None), getattr(landmark, "y", None)
    if x is None or y is None or not (math.isfinite(x) and math.isfinite(y)):
        return None, visibility
    if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
        return None, visibility
    # Pixel space keeps the true aspect ratio; normalized x/y would distort angles.
    return np.array([x * width, y * height]), visibility


# --------------------------------------------------------------------------- #
# Per-frame measurements (recorded during video processing)
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class ArmMeasurement:
    angle: Optional[float] = None       # projected elbow angle in degrees
    visibility: Optional[float] = None  # min visibility of shoulder, elbow, wrist


@dataclass(frozen=True)
class FrameMeasurement:
    frame_index: int
    timestamp_s: float
    pose_detected: bool
    left: ArmMeasurement = ArmMeasurement()
    right: ArmMeasurement = ArmMeasurement()
    torso_center: Optional[tuple[float, float]] = None  # pixels
    torso_length: Optional[float] = None                # shoulder-mid to hip-mid, pixels
    torso_visibility: Optional[float] = None
    camera_dx: Optional[float] = None  # background (wall) image shift since previous frame, pixels
    camera_dy: Optional[float] = None
    # Landmark index -> (x_px, y_px, visibility) for MOTION_LANDMARKS inside the frame.
    keypoints: Optional[dict] = None

    def arm(self, side: str) -> ArmMeasurement:
        return self.left if side == "left" else self.right


def _measure_arm(landmarks: Sequence, side: str, width: int, height: int) -> ArmMeasurement:
    points, visibilities = [], []
    for idx in ARM_LANDMARKS[side]:
        pt, vis = _landmark_px(landmarks[idx], width, height)
        points.append(pt)
        visibilities.append(vis)
    visibility = min(visibilities)
    if any(p is None for p in points):
        return ArmMeasurement(None, visibility)
    shoulder, elbow, wrist = points
    if np.linalg.norm(shoulder - elbow) < _MIN_SEGMENT_PX or np.linalg.norm(wrist - elbow) < _MIN_SEGMENT_PX:
        return ArmMeasurement(None, visibility)
    return ArmMeasurement(joint_angle(shoulder, elbow, wrist), visibility)


def measure_frame(
    frame_index: int,
    timestamp_s: float,
    landmarks: Optional[Sequence],
    width: int,
    height: int,
    camera_shift: Optional[tuple[float, float]] = None,
) -> FrameMeasurement:
    """Raw measurements for one frame. `landmarks` is one MediaPipe pose, or None if no pose."""
    dx, dy = camera_shift if camera_shift is not None else (None, None)
    if not landmarks or len(landmarks) <= RIGHT_HIP:
        return FrameMeasurement(frame_index, timestamp_s, False, camera_dx=dx, camera_dy=dy)

    left = _measure_arm(landmarks, "left", width, height)
    right = _measure_arm(landmarks, "right", width, height)

    torso = [_landmark_px(landmarks[i], width, height) for i in TORSO_LANDMARKS]
    torso_center = torso_length = None
    torso_visibility = min(v for _, v in torso)
    if all(p is not None for p, _ in torso):
        ls, rs, lh, rh = (p for p, _ in torso)
        shoulder_mid, hip_mid = (ls + rs) / 2, (lh + rh) / 2
        length = float(np.linalg.norm(shoulder_mid - hip_mid))
        if length >= _MIN_TORSO_PX:
            center = (shoulder_mid + hip_mid) / 2
            torso_center, torso_length = (float(center[0]), float(center[1])), length

    keypoints = {}
    for idx in MOTION_LANDMARKS:
        pt, vis = _landmark_px(landmarks[idx], width, height)
        if pt is not None:
            keypoints[idx] = (float(pt[0]), float(pt[1]), vis)

    return FrameMeasurement(
        frame_index, timestamp_s, True, left, right,
        torso_center, torso_length, torso_visibility, dx, dy, keypoints,
    )


# --------------------------------------------------------------------------- #
# Analysis
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class AnalysisConfig:
    """Initial heuristics - not established universal climbing thresholds."""
    bent_angle_threshold: float = 140.0   # degrees; below this the arm counts as bent
    release_hysteresis: float = 5.0       # an event ends once the angle reaches threshold + this
    min_duration_s: float = 1.5
    min_visibility: float = 0.6
    max_gap_s: float = 0.3                # tracking gaps up to this long don't split an event
    smoothing_window_s: float = 0.2       # centered median filter over valid frames only
    # Movement classification. Experimental heuristics; speeds are in torso lengths per second
    # of video time, so they are independent of resolution, camera distance and frame rate.
    motion_window_s: float = 0.5          # displacement is measured across this centered window
    limb_motion_threshold: float = 0.6    # hand/foot speed relative to the torso that counts as a reach or step
    limb_peak_threshold: float = 1.0      # a single faster spike in the interior counts as a reach
    translation_threshold: float = 0.25   # whole-body speed relative to the wall (camera-compensated)
    camera_motion_threshold: float = 0.3  # above this, whole-body movement is not judged
    active_fraction: float = 0.2          # share of the event interior with movement needed to call it active
    min_movement_s: float = 0.25          # ...or one continuous interior movement episode at least this long
    min_motion_coverage: float = 0.6      # share of an event with usable data needed to call it stationary
    min_extremities: int = 3              # hands/feet that must be tracked to rule out a reach or step


@dataclass(frozen=True)
class ArmSeries:
    raw: np.ndarray         # projected angle, NaN where not measurable
    visibility: np.ndarray  # NaN where unknown
    valid: np.ndarray       # bool: angle measurable and visibility >= threshold
    smoothed: np.ndarray    # NaN wherever `valid` is False


@dataclass(frozen=True)
class BentArmEvent:
    arm: str
    start_s: float
    end_s: float
    duration_s: float
    start_frame: int
    end_frame: int
    median_angle: float
    min_angle: float
    measured_fraction: float  # frames in the event with a valid angle
    mean_visibility: float
    tracking_quality: str     # "high" | "moderate" | "low"
    stillness: str            # "stationary" | "moving" | "uncertain"
    stillness_reason: str
    active_fraction: float    # share of the event with measured hand/foot or body movement
    flagged: bool             # True if reported as a technique observation
    measurement_text: str
    suggestion: str


@dataclass(frozen=True)
class AnalysisStats:
    duration_s: float
    total_frames: int
    frames_with_pose: int
    valid_left: int
    valid_right: int
    coverage_left: float
    coverage_right: float
    coverage_any: float
    sustained_bent_arm_periods: int
    observations: int


@dataclass(frozen=True)
class MotionSeries:
    """Per-frame movement estimates in torso lengths per second; NaN means unknown, never zero."""
    limb_speed: np.ndarray           # fastest tracked hand/foot, relative to the torso
    extremities_tracked: np.ndarray  # hands/feet with a speed estimate in this frame
    translation_speed: np.ndarray    # torso center relative to the wall (camera motion subtracted)
    camera_speed: np.ndarray         # background (wall) motion in the image


@dataclass(frozen=True)
class TechniqueAnalysis:
    config: AnalysisConfig
    times: np.ndarray
    arms: dict
    motion: MotionSeries
    events: list
    stats: AnalysisStats

    @property
    def observations(self) -> list:
        return [e for e in self.events if e.flagged]

    @property
    def sufficient_data(self) -> bool:
        return max(self.stats.coverage_left, self.stats.coverage_right) >= MIN_COVERAGE_FOR_ANALYSIS


def _runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """Inclusive (start, end) index pairs of consecutive True values."""
    runs, start = [], None
    for i, value in enumerate(mask):
        if value and start is None:
            start = i
        elif not value and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(mask) - 1))
    return runs


def _median_smooth(values: np.ndarray, valid: np.ndarray, half_window: int) -> np.ndarray:
    """Centered median within each contiguous valid run; gaps stay NaN and are never bridged."""
    out = np.full(len(values), np.nan)
    for start, end in _runs(valid):
        for i in range(start, end + 1):
            lo, hi = max(start, i - half_window), min(end, i + half_window)
            out[i] = np.median(values[lo:hi + 1])
    return out


def _windowed_speed(
    times: np.ndarray, x: np.ndarray, y: np.ndarray, ok: np.ndarray, scale: np.ndarray, half_window: int
) -> np.ndarray:
    """Displacement across a centered window divided by elapsed time and body scale.

    Defined only where the frame itself and both window ends were measured.
    """
    n = len(times)
    speed = np.full(n, np.nan)
    for i in range(n):
        lo, hi = max(0, i - half_window), min(n - 1, i + half_window)
        if hi <= lo or not (ok[lo] and ok[hi] and ok[i]):
            continue
        dt = times[hi] - times[lo]
        s = np.nanmean([scale[lo], scale[hi]]) if np.isfinite([scale[lo], scale[hi]]).any() else np.nan
        if dt <= 0 or not np.isfinite(s) or s <= 0:
            continue
        speed[i] = math.hypot(x[hi] - x[lo], y[hi] - y[lo]) / dt / s
    return speed


def _arm_series(measurements: Sequence[FrameMeasurement], side: str, cfg: AnalysisConfig, half_window: int) -> ArmSeries:
    raw = np.array([m.arm(side).angle if m.arm(side).angle is not None else np.nan for m in measurements], float)
    vis = np.array([m.arm(side).visibility if m.arm(side).visibility is not None else np.nan for m in measurements], float)
    valid = np.isfinite(raw) & np.isfinite(vis) & (np.nan_to_num(vis) >= cfg.min_visibility)
    return ArmSeries(raw, vis, valid, _median_smooth(raw, valid, half_window))


def _motion(measurements: Sequence[FrameMeasurement], times: np.ndarray, cfg: AnalysisConfig, fps: float) -> MotionSeries:
    """Windowed movement estimates, normalized by torso length and elapsed video time."""
    n = len(measurements)
    half = max(1, int(round(cfg.motion_window_s * fps / 2)))
    smooth_half = max(0, int(round(cfg.smoothing_window_s * fps / 2)))
    ones = np.ones(n)

    torso_ok = np.array([
        m.torso_center is not None and (m.torso_visibility or 0.0) >= cfg.min_visibility for m in measurements
    ])
    cx = np.array([m.torso_center[0] if m.torso_center else np.nan for m in measurements], float)
    cy = np.array([m.torso_center[1] if m.torso_center else np.nan for m in measurements], float)
    scale = np.array([m.torso_length if m.torso_length else np.nan for m in measurements], float)
    scale[~torso_ok] = np.nan

    # Hands and feet relative to the torso, in torso lengths. Camera panning moves the whole
    # body in the image but does not change these, so they reveal reaches and steps reliably.
    limb_speeds = []
    for idx in EXTREMITY_LANDMARKS:
        ok = torso_ok & np.array([
            bool(m.keypoints) and idx in m.keypoints and m.keypoints[idx][2] >= cfg.min_visibility
            for m in measurements
        ])
        rx = np.array([(m.keypoints[idx][0] - cx[i]) / scale[i] if ok[i] else np.nan for i, m in enumerate(measurements)])
        ry = np.array([(m.keypoints[idx][1] - cy[i]) / scale[i] if ok[i] else np.nan for i, m in enumerate(measurements)])
        rx, ry = _median_smooth(rx, ok, smooth_half), _median_smooth(ry, ok, smooth_half)
        limb_speeds.append(_windowed_speed(times, rx, ry, ok, ones, half))
    limb_speeds = np.vstack(limb_speeds) if n else np.empty((len(EXTREMITY_LANDMARKS), 0))
    extremities_tracked = np.isfinite(limb_speeds).sum(axis=0)
    limb_speed = np.full(n, np.nan)
    any_limb = extremities_tracked > 0
    limb_speed[any_limb] = np.nanmax(limb_speeds[:, any_limb], axis=0)

    # Camera path = cumulative background flow. A window is usable only if every step in it is known.
    dx = np.array([m.camera_dx if m.camera_dx is not None else np.nan for m in measurements], float)
    dy = np.array([m.camera_dy if m.camera_dy is not None else np.nan for m in measurements], float)
    unknown = ~(np.isfinite(dx) & np.isfinite(dy))
    path_x, path_y = np.cumsum(np.where(unknown, 0, dx)), np.cumsum(np.where(unknown, 0, dy))
    unknown_count = np.cumsum(unknown)
    global_scale = np.nanmedian(scale) if np.isfinite(scale).any() else np.nan
    cam_scale = np.where(np.isfinite(scale), scale, global_scale)
    camera_known = np.zeros(n, dtype=bool)
    for i in range(n):
        lo, hi = max(0, i - half), min(n - 1, i + half)
        # Shifts at indices lo+1..hi describe the motion between frames lo and hi.
        camera_known[i] = hi > lo and unknown_count[hi] - unknown_count[lo] == 0
    camera_speed = _windowed_speed(times, path_x, path_y, np.ones(n, dtype=bool), cam_scale, half)
    camera_speed[~camera_known] = np.nan

    # Torso relative to the wall: image position minus the background's own image motion.
    smooth_cx, smooth_cy = _median_smooth(cx, torso_ok, smooth_half), _median_smooth(cy, torso_ok, smooth_half)
    translation_speed = _windowed_speed(times, smooth_cx - path_x, smooth_cy - path_y, torso_ok, scale, half)
    translation_speed[~camera_known] = np.nan

    return MotionSeries(limb_speed, extremities_tracked, translation_speed, camera_speed)


def _classify_stillness(
    start: int, end: int, times: np.ndarray, motion: MotionSeries, cfg: AnalysisConfig
) -> tuple[str, str, float]:
    """Label an event "moving", "stationary" or "uncertain". Returns (label, reason, active fraction).

    Movement needs positive evidence (hands/feet moving relative to the torso, or the body moving
    along the wall while the camera is steady) in a large share of the event or in one sustained
    episode such as a reach. Stillness needs the opposite evidence *and* enough tracking coverage;
    missing data is never treated as zero movement.
    """
    full = np.arange(start, end + 1)
    # Ignore the edges: windowed speeds there include the arm folding into / out of the
    # bent position, which is not itself a climbing move.
    margin = cfg.motion_window_s / 2
    inner = full[(times[full] >= times[start] + margin) & (times[full] <= times[end] - margin)]
    span = inner if len(inner) >= 3 else full
    limb, extremities = motion.limb_speed[span], motion.extremities_tracked[span]
    translation, camera = motion.translation_speed[span], motion.camera_speed[span]

    camera_steady = np.isfinite(camera) & (camera <= cfg.camera_motion_threshold)
    limb_moving = np.isfinite(limb) & (limb > cfg.limb_motion_threshold)
    body_moving = camera_steady & np.isfinite(translation) & (translation > cfg.translation_threshold)
    moving = limb_moving | body_moving
    moving_fraction = float(moving.mean())
    longest_episode = max((times[span][b] - times[span][a] for a, b in _runs(moving)), default=-1.0)
    peak = float(np.nanmax(limb)) if np.isfinite(limb).any() else 0.0

    if (
        moving_fraction >= cfg.active_fraction
        or longest_episode >= cfg.min_movement_s
        or peak >= cfg.limb_peak_threshold
    ):
        if peak >= cfg.limb_peak_threshold or limb_moving.sum() >= body_moving.sum():
            reason = "your hands or feet moved relative to your body, as in a reach or step"
        else:
            reason = "your body moved along the wall"
        return "moving", reason, moving_fraction

    limbs_covered = np.isfinite(limb) & (extremities >= cfg.min_extremities)
    if limbs_covered.mean() < cfg.min_motion_coverage:
        return "uncertain", "your hands and feet were not tracked well enough to rule out reaches or steps", moving_fraction
    camera_known = np.isfinite(camera)
    if camera_known.mean() < cfg.min_motion_coverage:
        return "uncertain", "camera motion could not be estimated", moving_fraction
    if np.median(camera[camera_known]) > cfg.camera_motion_threshold:
        return "uncertain", "the camera was moving, so whole-body movement could not be judged", moving_fraction
    if (camera_steady & np.isfinite(translation)).mean() < cfg.min_motion_coverage:
        return "uncertain", "your hips and shoulders were not tracked well enough to judge body movement", moving_fraction
    return "stationary", "your hands, feet and torso moved little", moving_fraction


def _tracking_quality(measured_fraction: float, mean_visibility: float) -> str:
    if measured_fraction >= 0.9 and mean_visibility >= 0.8:
        return "high"
    if measured_fraction >= 0.7 and mean_visibility >= 0.65:
        return "moderate"
    return "low"


def format_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f} s"
    minutes, rest = divmod(seconds, 60)
    return f"{int(minutes)}:{rest:04.1f}"


def _describe(arm: str, start_s: float, duration_s: float, angle: float, stillness: str, reason: str):
    measured = (
        f"At {format_time(start_s)}, your {arm} elbow appeared bent at approximately "
        f"{angle:.0f} degrees for {duration_s:.1f} seconds"
    )
    if stillness == "stationary":
        return (
            measured + " while your body position appeared relatively stable (your hands, feet and torso moved little).",
            "If your holds and body position allow it, consider relaxing into a straighter arm while holding "
            "this position. Straighter arms are commonly encouraged in climbing coaching, but a bent arm can be "
            "the right choice on some holds or while setting up the next move.",
        )
    if stillness == "uncertain":
        return (
            measured + f". Whether you were holding a position or moving could not be determined ({reason}).",
            "Because movement could not be judged reliably, no technique suggestion is made for this period. "
            "You can review this part of the video yourself.",
        )
    return (
        measured + f" while you were actively moving ({reason}).",
        "Bent arms are a normal part of many climbing moves, so no change is suggested for this period.",
    )


def _detect_arm_events(
    side: str, times: np.ndarray, frames: np.ndarray, series: ArmSeries, motion: MotionSeries, cfg: AnalysisConfig,
) -> list[BentArmEvent]:
    """Find sustained bent-arm periods for one arm.

    An event starts when the smoothed angle drops below the threshold and ends when the arm
    opens past threshold + hysteresis, or when tracking is lost for longer than `max_gap_s`.
    Gap frames are never assigned an angle.
    """
    spans: list[tuple[int, int]] = []
    start = last_bent = None
    for i in range(len(times)):
        if series.valid[i]:
            angle = series.smoothed[i]
            if start is None:
                if angle < cfg.bent_angle_threshold:
                    start = last_bent = i
            elif angle < cfg.bent_angle_threshold + cfg.release_hysteresis:
                last_bent = i
            else:
                spans.append((start, last_bent))
                start = None
        elif start is not None and times[i] - times[last_bent] > cfg.max_gap_s:
            spans.append((start, last_bent))
            start = None
    if start is not None:
        spans.append((start, last_bent))

    events = []
    for s, e in spans:
        duration = float(times[e] - times[s])
        if duration < cfg.min_duration_s:
            continue
        in_span = series.valid[s:e + 1]
        angles = series.smoothed[s:e + 1][in_span]
        measured_fraction = float(in_span.mean())
        mean_vis = float(np.mean(series.visibility[s:e + 1][in_span]))
        median_angle = float(np.median(angles))
        stillness, reason, active = _classify_stillness(s, e, times, motion, cfg)
        measurement_text, suggestion = _describe(side, float(times[s]), duration, median_angle, stillness, reason)
        events.append(BentArmEvent(
            arm=side,
            start_s=round(float(times[s]), 3),
            end_s=round(float(times[e]), 3),
            duration_s=round(duration, 3),
            start_frame=int(frames[s]),
            end_frame=int(frames[e]),
            median_angle=round(median_angle, 1),
            min_angle=round(float(np.min(angles)), 1),
            measured_fraction=round(measured_fraction, 3),
            mean_visibility=round(mean_vis, 3),
            tracking_quality=_tracking_quality(measured_fraction, mean_vis),
            stillness=stillness,
            stillness_reason=reason,
            active_fraction=round(active, 3),
            flagged=stillness != "moving",
            measurement_text=measurement_text,
            suggestion=suggestion,
        ))
    return events


def analyze(measurements: Sequence[FrameMeasurement], fps: float, config: AnalysisConfig | None = None) -> TechniqueAnalysis:
    """Run the elbow-angle analysis on measurements recorded during video processing."""
    cfg = config or AnalysisConfig()
    n = len(measurements)
    times = np.array([m.timestamp_s for m in measurements], float)
    frames = np.array([m.frame_index for m in measurements], int)
    half_window = max(0, int(round(cfg.smoothing_window_s * fps / 2)))

    arms = {side: _arm_series(measurements, side, cfg, half_window) for side in ARMS}
    motion = _motion(measurements, times, cfg, fps)

    events = []
    for side in ARMS:
        events += _detect_arm_events(side, times, frames, arms[side], motion, cfg)
    events.sort(key=lambda e: (e.start_s, e.arm))

    valid_left, valid_right = int(arms["left"].valid.sum()), int(arms["right"].valid.sum())
    any_valid = int((arms["left"].valid | arms["right"].valid).sum())
    stats = AnalysisStats(
        duration_s=round(n / fps, 3) if fps > 0 else 0.0,
        total_frames=n,
        frames_with_pose=sum(m.pose_detected for m in measurements),
        valid_left=valid_left,
        valid_right=valid_right,
        coverage_left=valid_left / n if n else 0.0,
        coverage_right=valid_right / n if n else 0.0,
        coverage_any=any_valid / n if n else 0.0,
        sustained_bent_arm_periods=len(events),
        observations=sum(e.flagged for e in events),
    )
    return TechniqueAnalysis(cfg, times, arms, motion, events, stats)


# --------------------------------------------------------------------------- #
# Export
# --------------------------------------------------------------------------- #

def _fmt(value, digits: int = 2) -> str:
    return "" if value is None or not np.isfinite(value) else f"{value:.{digits}f}"


def analysis_to_csv(analysis: TechniqueAnalysis, measurements: Sequence[FrameMeasurement]) -> str:
    """Per-frame measured data. Empty cells mean no measurement was available."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow([
        "frame", "time_s", "pose_detected",
        "left_elbow_angle_deg", "left_elbow_angle_smoothed_deg", "left_visibility", "left_valid",
        "right_elbow_angle_deg", "right_elbow_angle_smoothed_deg", "right_visibility", "right_valid",
        "limb_speed_torso_lengths_per_s", "extremities_tracked",
        "body_translation_torso_lengths_per_s", "camera_speed_torso_lengths_per_s",
    ])
    left, right, motion = analysis.arms["left"], analysis.arms["right"], analysis.motion
    for i, m in enumerate(measurements):
        writer.writerow([
            m.frame_index, f"{m.timestamp_s:.3f}", int(m.pose_detected),
            _fmt(left.raw[i]), _fmt(left.smoothed[i]), _fmt(left.visibility[i], 3), int(left.valid[i]),
            _fmt(right.raw[i]), _fmt(right.smoothed[i]), _fmt(right.visibility[i], 3), int(right.valid[i]),
            _fmt(motion.limb_speed[i], 3), int(motion.extremities_tracked[i]),
            _fmt(motion.translation_speed[i], 3), _fmt(motion.camera_speed[i], 3),
        ])
    return buffer.getvalue()


def analysis_to_json(analysis: TechniqueAnalysis) -> str:
    return json.dumps({
        "notes": [
            ANGLE_DISCLAIMER,
            "Observations come from simple rule-based heuristics with configurable thresholds. "
            "Bent arms are normal during many climbing moves; flagged periods are suggestions, not errors.",
            "Movement labels (stationary / moving / uncertain) use experimental thresholds on hand, foot and "
            "body motion measured in torso lengths per second; they do not indicate resting or fatigue.",
            "Left/right refer to the climber's own left and right as estimated by MediaPipe.",
        ],
        "config": asdict(analysis.config),
        "summary": asdict(analysis.stats),
        "events": [asdict(e) for e in analysis.events],
    }, indent=2)
