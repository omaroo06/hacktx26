"""Unit tests for elbow-angle measurement and bent-arm detection, using synthetic landmarks only."""

import csv
import io
import json
import math
from types import SimpleNamespace

import numpy as np
import pytest

from pose_analysis.technique_analysis import (
    AnalysisConfig,
    analysis_to_csv,
    analysis_to_json,
    analyze,
    joint_angle,
    measure_frame,
)

W = H = 1000
FPS = 30.0


def _lm(x, y, visibility=0.95):
    return SimpleNamespace(x=x, y=y, visibility=visibility)


def make_landmarks(left_angle=180.0, right_angle=180.0, arm_vis=0.95, hip_vis=0.95, offset=(0.0, 0.0),
                   right_upper_arm=0.0, foot_lift=0.0, ankle_vis=0.95, jitter=None):
    """33 synthetic landmarks: torso, arms with the given elbow angles, and legs.

    `right_upper_arm` rotates the whole right arm about the shoulder (0 = hanging down,
    150 = reaching up) without changing its elbow angle. `foot_lift` raises the left foot.
    """
    ox, oy = offset
    lms = [_lm(0.5, 0.5, 0.0) for _ in range(33)]
    lms[11], lms[12] = _lm(0.40 + ox, 0.30 + oy), _lm(0.60 + ox, 0.30 + oy)
    lms[23], lms[24] = _lm(0.42 + ox, 0.60 + oy, hip_vis), _lm(0.58 + ox, 0.60 + oy, hip_vis)
    lms[25], lms[26] = _lm(0.42 + ox, 0.70 + oy - foot_lift), _lm(0.58 + ox, 0.70 + oy)
    lms[27], lms[28] = _lm(0.42 + ox, 0.80 + oy - foot_lift, ankle_vis), _lm(0.58 + ox, 0.80 + oy, ankle_vis)

    def place_arm(shoulder, angle, upper_deg, sign, idx_elbow, idx_wrist):
        phi = math.radians(upper_deg)
        ux, uy = sign * math.sin(phi), math.cos(phi)  # shoulder -> elbow direction
        ex, ey = shoulder.x + 0.12 * ux, shoulder.y + 0.12 * uy
        a = sign * math.radians(angle)                # rotate elbow -> shoulder by the elbow angle
        wx = -ux * math.cos(a) + uy * math.sin(a)
        wy = -ux * math.sin(a) - uy * math.cos(a)
        lms[idx_elbow], lms[idx_wrist] = _lm(ex, ey, arm_vis), _lm(ex + 0.12 * wx, ey + 0.12 * wy, arm_vis)

    place_arm(lms[11], left_angle, 0.0, -1, 13, 15)
    place_arm(lms[12], right_angle, right_upper_arm, +1, 14, 16)
    if jitter is not None:
        for lm in lms:
            lm.x += jitter.normal(0, 0.002)
            lm.y += jitter.normal(0, 0.002)
    return lms


def build(duration_s, left=lambda t: 175.0, right=lambda t: 175.0, detected=lambda t: True,
          arm_vis=lambda t: 0.95, hip_vis=lambda t: 0.95, offset=lambda t: (0.0, 0.0),
          camera=lambda t: (0.0, 0.0), right_upper_arm=lambda t: 0.0, foot_lift=lambda t: 0.0,
          ankle_vis=lambda t: 0.95, jitter_seed=None, fps=FPS):
    """Synthetic frame measurements; each argument is a function of time in seconds."""
    rng = np.random.default_rng(jitter_seed) if jitter_seed is not None else None
    out = []
    for i in range(int(round(duration_s * fps))):
        t = i / fps
        lms = make_landmarks(
            left(t), right(t), arm_vis(t), hip_vis(t), offset(t),
            right_upper_arm(t), foot_lift(t), ankle_vis(t), rng,
        ) if detected(t) else None
        out.append(measure_frame(i, t, lms, W, H, None if i == 0 else camera(t)))
    return out


def ramp(start, end, low, high):
    """Smoothly goes from `low` to `high` between `start` and `end` seconds."""
    return lambda t: low + (high - low) * min(max((t - start) / (end - start), 0.0), 1.0)


def bent_between(start, end, angle=100.0, straight=175.0):
    return lambda t: angle if start <= t < end else straight


# --- 1-4: geometry, invalid input, low confidence ----------------------------

def test_straight_arm_is_about_180_degrees():
    assert joint_angle((0, 0), (0, 1), (0, 2)) == pytest.approx(180.0)


def test_right_angle_is_about_90_degrees():
    assert joint_angle((0, 0), (0, 1), (1, 1)) == pytest.approx(90.0)


def test_fully_folded_arm_is_zero_and_never_nan():
    assert joint_angle((0, 0), (0, 1), (0, 0.5)) == pytest.approx(0.0)
    # Nearly collinear vectors can push the cosine slightly past 1 without clamping.
    angle = joint_angle((0, 0), (1e-8, 1), (2e-8, 2))
    assert angle is not None and 179.9 <= angle <= 180.0


@pytest.mark.parametrize("points", [
    ((0, 0), (0, 0), (1, 1)),             # zero-length upper arm
    ((0, 0), (0, 1), (0, 1)),             # zero-length forearm
    ((float("nan"), 0), (0, 1), (1, 1)),  # invalid coordinate
])
def test_degenerate_geometry_returns_none(points):
    assert joint_angle(*points) is None


def test_measure_frame_uses_pixel_space_not_normalized_coordinates():
    lms = make_landmarks()
    lms[11], lms[13], lms[15] = _lm(0.5, 0.3), _lm(0.5, 0.5), _lm(0.6, 0.3)
    # Normalized angle would be ~26.6°, but in a 2000x1000 frame the pixel angle is 45°.
    m = measure_frame(0, 0.0, lms, 2000, 1000)
    assert m.left.angle == pytest.approx(45.0, abs=0.01)


def test_synthetic_landmarks_produce_requested_angles():
    m = measure_frame(0, 0.0, make_landmarks(left_angle=90, right_angle=150), W, H)
    assert m.left.angle == pytest.approx(90.0, abs=0.01)
    assert m.right.angle == pytest.approx(150.0, abs=0.01)


def test_no_pose_gives_no_measurements():
    m = measure_frame(5, 0.2, None, W, H)
    assert not m.pose_detected
    assert m.left.angle is None and m.right.angle is None and m.torso_center is None


def test_out_of_frame_wrist_gives_no_angle():
    lms = make_landmarks()
    lms[15] = _lm(1.2, 0.5)
    m = measure_frame(0, 0.0, lms, W, H)
    assert m.left.angle is None
    assert m.right.angle is not None


def test_low_confidence_landmarks_are_marked_invalid():
    measurements = build(3.0, left=lambda t: 100.0, arm_vis=lambda t: 0.3)
    analysis = analyze(measurements, FPS)
    left = analysis.arms["left"]
    assert np.isfinite(left.raw).all()          # geometry was measurable...
    assert not left.valid.any()                 # ...but confidence too low to trust
    assert np.isnan(left.smoothed).all()
    assert analysis.events == []
    assert not analysis.sufficient_data


# --- 5-6: short vs sustained events ------------------------------------------

def test_short_bent_arm_is_not_flagged():
    analysis = analyze(build(5.0, left=bent_between(1.0, 2.0)), FPS)
    assert analysis.events == []


def test_sustained_bent_arm_while_still_is_detected():
    analysis = analyze(build(6.0, right=bent_between(1.0, 3.5, angle=108)), FPS)
    assert len(analysis.events) == 1
    event = analysis.events[0]
    assert event.arm == "right"
    assert event.start_s == pytest.approx(1.0, abs=0.15)
    assert event.duration_s == pytest.approx(2.5, abs=0.15)
    assert event.median_angle == pytest.approx(108, abs=1)
    assert event.stillness == "stationary" and event.flagged
    assert event.tracking_quality == "high"
    assert "right elbow appeared bent at approximately 108 degrees" in event.measurement_text
    assert "relatively stable" in event.measurement_text
    assert "straighter arm" in event.suggestion


# --- movement classification -------------------------------------------------------

def _only_event(analysis):
    assert len(analysis.events) == 1, analysis.events
    return analysis.events[0]


def test_stationary_position_with_landmark_jitter_stays_stationary():
    event = _only_event(analyze(build(6.0, left=bent_between(1.0, 4.0), jitter_seed=1), FPS))
    assert event.stillness == "stationary"
    assert event.active_fraction < 0.1


def test_active_reach_with_other_arm_is_classified_as_moving():
    # Left arm stays bent while the right arm reaches overhead between 2.0 and 2.6 s.
    measurements = build(6.0, left=bent_between(1.0, 4.0), right_upper_arm=ramp(2.0, 2.6, 0.0, 150.0))
    event = _only_event(analyze(measurements, FPS))
    assert event.stillness == "moving" and not event.flagged
    assert "reach or step" in event.stillness_reason
    assert "actively moving" in event.measurement_text
    assert "straighter" not in event.suggestion and "no change is suggested" in event.suggestion


def test_high_step_is_classified_as_moving():
    measurements = build(6.0, left=bent_between(1.0, 4.0), foot_lift=ramp(2.2, 2.8, 0.0, 0.15))
    assert _only_event(analyze(measurements, FPS)).stillness == "moving"


def test_whole_body_movement_along_wall_is_classified_as_moving():
    # Torso rises at ~0.33 torso lengths per second while the camera is still.
    measurements = build(5.0, left=bent_between(1.0, 3.5), offset=lambda t: (0.0, 0.2 - 0.1 * t))
    event = _only_event(analyze(measurements, FPS))
    assert event.stillness == "moving"
    assert event.stillness_reason == "your body moved along the wall"
    assert analyze(measurements, FPS).observations == []


def test_reach_is_detected_even_when_camera_follows_the_climber():
    # The camera pans with the climber (large background motion), but hand motion relative
    # to the torso does not depend on the camera.
    measurements = build(6.0, left=bent_between(1.0, 4.0), right_upper_arm=ramp(2.0, 2.6, 0.0, 150.0),
                         camera=lambda t: (0.0, 10.0))
    assert _only_event(analyze(measurements, FPS)).stillness == "moving"


def test_camera_motion_without_limb_motion_is_uncertain():
    event = _only_event(analyze(build(5.0, left=bent_between(1.0, 3.5), camera=lambda t: (8.0, 0.0)), FPS))
    assert event.stillness == "uncertain" and event.flagged
    assert "camera" in event.stillness_reason
    assert "straighter" not in event.suggestion and "no technique suggestion" in event.suggestion


def test_unknown_camera_motion_is_uncertain():
    measurements = build(5.0, left=bent_between(1.0, 3.5), camera=lambda t: None)
    event = _only_event(analyze(measurements, FPS))
    assert event.stillness == "uncertain"
    assert "camera motion could not be estimated" in event.stillness_reason


def test_occluded_hands_and_feet_are_not_treated_as_still():
    # Only one extremity (the left wrist) is visible: no movement is seen, but that is not evidence of stillness.
    measurements = []
    for m in build(5.0, left=bent_between(1.0, 3.5), ankle_vis=lambda t: 0.1):
        kp = dict(m.keypoints)
        kp[16] = (kp[16][0], kp[16][1], 0.1)
        measurements.append(type(m)(**{**m.__dict__, "keypoints": kp}))
    analysis = analyze(measurements, FPS)
    event = _only_event(analysis)
    assert event.stillness == "uncertain"
    assert "hands and feet were not tracked" in event.stillness_reason
    assert (analysis.motion.extremities_tracked <= 1).all()


def test_hidden_hips_make_movement_uncertain():
    event = _only_event(analyze(build(5.0, left=bent_between(1.0, 3.5), hip_vis=lambda t: 0.2), FPS))
    assert event.stillness == "uncertain"
    assert "could not be determined" in event.measurement_text


def test_frequent_missing_detections_give_unknown_motion_not_zero():
    # Pose found for 0.1 s out of every 0.3 s: the bent arm survives the short gaps,
    # but most motion windows are unmeasurable, so stillness cannot be claimed.
    detected = lambda t: (t % 0.3) < 0.1
    analysis = analyze(build(6.0, left=lambda t: 100.0, detected=detected), FPS)
    event = _only_event(analysis)
    assert event.stillness == "uncertain"
    missing = ~np.array([detected(t) for t in analysis.times])
    # Frames without a pose contribute no new measurement; a speed is only defined
    # when both ends of the motion window have a pose.
    assert np.isnan(analysis.motion.limb_speed[missing]).mean() > 0.9


def test_movement_thresholds_are_configurable():
    measurements = build(6.0, left=bent_between(1.0, 4.0), right_upper_arm=ramp(2.0, 2.6, 0.0, 150.0))
    assert _only_event(analyze(measurements, FPS)).stillness == "moving"
    relaxed = AnalysisConfig(limb_motion_threshold=50.0, limb_peak_threshold=50.0)
    assert _only_event(analyze(measurements, FPS, relaxed)).stillness == "stationary"


def test_motion_speeds_do_not_depend_on_frame_rate():
    move = dict(left=bent_between(1.0, 4.0), offset=lambda t: (0.0, 0.2 - 0.1 * t))
    speed_30 = np.nanmedian(analyze(build(5.0, fps=30.0, **move), 30.0).motion.translation_speed)
    speed_60 = np.nanmedian(analyze(build(5.0, fps=60.0, **move), 60.0).motion.translation_speed)
    assert speed_30 == pytest.approx(1 / 3, rel=0.05)
    assert speed_60 == pytest.approx(speed_30, rel=0.05)


def test_single_frame_spike_does_not_split_event():
    angles = lambda t: 175.0 if abs(t - 2.0) < 0.5 / FPS else bent_between(1.0, 3.5)(t)
    analysis = analyze(build(5.0, left=angles), FPS)
    assert len(analysis.events) == 1


# --- 7: tracking gaps ----------------------------------------------------------

def test_short_tracking_gap_does_not_split_event_or_invent_angles():
    gap = lambda t: not (2.0 <= t < 2.15)
    analysis = analyze(build(5.0, left=bent_between(1.0, 3.5), detected=gap), FPS)
    assert len(analysis.events) == 1
    event = analysis.events[0]
    assert event.duration_s == pytest.approx(2.5, abs=0.15)
    assert event.measured_fraction < 1.0
    gap_frames = (analysis.times >= 2.0) & (analysis.times < 2.15)
    assert gap_frames.any()
    assert not analysis.arms["left"].valid[gap_frames].any()
    assert np.isnan(analysis.arms["left"].smoothed[gap_frames]).all()


def test_long_tracking_gap_splits_events():
    gap = lambda t: not (3.0 <= t < 4.0)
    analysis = analyze(build(7.0, left=bent_between(0.5, 6.5), detected=gap), FPS)
    left_events = [e for e in analysis.events if e.arm == "left"]
    assert len(left_events) == 2
    assert left_events[0].end_s < 3.0 < 4.0 <= left_events[1].start_s


def test_gap_leaving_too_little_bent_time_is_not_flagged():
    gap = lambda t: not (2.0 <= t < 3.0)
    analysis = analyze(build(5.0, left=bent_between(1.0, 4.0), detected=gap), FPS)
    assert analysis.events == []


# --- 8: left / right separation --------------------------------------------------

def test_left_and_right_arms_are_analyzed_independently():
    analysis = analyze(build(7.0, left=bent_between(0.5, 3.0), right=bent_between(3.5, 6.5, angle=120)), FPS)
    by_arm = {e.arm: e for e in analysis.events}
    assert set(by_arm) == {"left", "right"} and len(analysis.events) == 2
    assert by_arm["left"].end_s < 3.1 and by_arm["right"].start_s > 3.4
    assert by_arm["right"].median_angle == pytest.approx(120, abs=1)


def test_one_arm_hidden_does_not_affect_the_other():
    measurements = build(5.0, left=lambda t: 100.0, right=lambda t: 100.0)
    # Hide the right wrist in every frame.
    hidden = []
    for m in measurements:
        lms = make_landmarks(100.0, 100.0)
        lms[16] = _lm(lms[16].x, lms[16].y, 0.1)
        hidden.append(measure_frame(m.frame_index, m.timestamp_s, lms, W, H, (0.0, 0.0)))
    analysis = analyze(hidden, FPS)
    assert [e.arm for e in analysis.events] == ["left"]
    assert analysis.stats.valid_right == 0 and analysis.stats.coverage_left == 1.0


# --- statistics and export ---------------------------------------------------------

def test_custom_threshold_changes_results_without_new_measurements():
    measurements = build(5.0, left=bent_between(1.0, 3.5, angle=130))
    assert len(analyze(measurements, FPS).events) == 1
    assert analyze(measurements, FPS, AnalysisConfig(bent_angle_threshold=120)).events == []


def test_stats_and_exports():
    measurements = build(4.0, left=bent_between(0.5, 3.0), detected=lambda t: t < 3.5)
    analysis = analyze(measurements, FPS)
    stats = analysis.stats
    assert stats.total_frames == 120
    assert stats.duration_s == pytest.approx(4.0)
    assert stats.frames_with_pose == 105
    assert stats.valid_left == 105 and stats.coverage_any == pytest.approx(105 / 120)

    rows = list(csv.DictReader(io.StringIO(analysis_to_csv(analysis, measurements))))
    assert len(rows) == 120
    assert rows[0]["left_valid"] == "1" and float(rows[30]["left_elbow_angle_deg"]) == pytest.approx(100, abs=0.01)
    assert rows[-1]["pose_detected"] == "0" and rows[-1]["left_elbow_angle_deg"] == ""

    data = json.loads(analysis_to_json(analysis))
    assert data["summary"]["observations"] == stats.observations == 1
    assert data["events"][0]["arm"] == "left"
    assert data["config"]["bent_angle_threshold"] == 140.0
