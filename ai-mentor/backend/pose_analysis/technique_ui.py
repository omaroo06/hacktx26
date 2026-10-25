"""Streamlit rendering for the Technique Analysis section (elbow angles + bent-arm observations)."""

from __future__ import annotations

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st

from pose_analysis.technique_analysis import (
    ANGLE_DISCLAIMER,
    ARMS,
    AnalysisConfig,
    TechniqueAnalysis,
    analysis_to_csv,
    analysis_to_json,
    analyze,
    format_time,
)
from pose_analysis.video_processor import ProcessingResult

ARM_COLORS = {"Left": "#1f77b4", "Right": "#ff7f0e"}
STILLNESS_LABELS = {"stationary": "Still", "uncertain": "Uncertain", "moving": "Active"}


def analysis_settings(disabled: bool) -> AnalysisConfig:
    """Sidebar controls for the detector heuristics."""
    st.subheader("Technique analysis")
    defaults = AnalysisConfig()
    threshold = st.slider(
        "Bent-arm angle threshold (°)", 90, 170, int(defaults.bent_angle_threshold), step=5,
        disabled=disabled, help="Elbow angles below this count as bent.",
    )
    duration = st.slider(
        "Minimum duration (s)", 0.5, 5.0, defaults.min_duration_s, step=0.1,
        disabled=disabled, help="A bent arm must be held at least this long to be reported.",
    )
    visibility = st.slider(
        "Minimum landmark visibility", 0.3, 0.95, defaults.min_visibility, step=0.05,
        disabled=disabled, help="Shoulder, elbow and wrist must all be at least this visible.",
    )
    with st.expander("Movement thresholds (experimental)"):
        st.caption(
            "Speeds are in torso lengths per second. These decide whether a bent-arm period was "
            "active climbing, a relatively still position, or uncertain."
        )
        limb = st.slider(
            "Hand/foot movement", 0.2, 1.5, defaults.limb_motion_threshold, step=0.05, disabled=disabled,
            help="Hand or foot speed relative to the torso that counts as a reach or step.",
        )
        peak = st.slider(
            "Reach / step peak", 0.4, 2.0, defaults.limb_peak_threshold, step=0.1, disabled=disabled,
            help="A single faster hand or foot spike inside the period also counts as active climbing.",
        )
        translation = st.slider(
            "Whole-body movement", 0.1, 1.0, defaults.translation_threshold, step=0.05, disabled=disabled,
            help="Torso speed along the wall (camera motion subtracted) that counts as moving.",
        )
        camera = st.slider(
            "Camera motion limit", 0.1, 1.0, defaults.camera_motion_threshold, step=0.05, disabled=disabled,
            help="Above this camera speed, whole-body movement is not judged and stillness is reported as uncertain.",
        )
        episode = st.slider(
            "Shortest movement episode (s)", 0.1, 1.0, defaults.min_movement_s, step=0.05, disabled=disabled,
            help="A continuous movement at least this long (e.g. a reach) makes the period active.",
        )
    st.caption(
        "These are starting heuristics, not established climbing thresholds. "
        "Changing them re-runs the analysis instantly without reprocessing the video."
    )
    return AnalysisConfig(
        bent_angle_threshold=float(threshold), min_duration_s=float(duration), min_visibility=float(visibility),
        limb_motion_threshold=float(limb), limb_peak_threshold=float(peak),
        translation_threshold=float(translation),
        camera_motion_threshold=float(camera), min_movement_s=float(episode),
    )


def _angle_chart(analysis: TechniqueAnalysis) -> alt.Chart | None:
    frames = []
    for side in ARMS:
        series = analysis.arms[side]
        # Each contiguous run of valid frames gets its own line segment, so gaps are never bridged.
        segment = np.cumsum(~series.valid)
        df = pd.DataFrame({
            "time": analysis.times,
            "angle": series.smoothed,
            "arm": side.capitalize(),
            "segment": [f"{side}-{k}" for k in segment],
        })
        frames.append(df[series.valid])
    data = pd.concat(frames, ignore_index=True)
    if data.empty:
        return None

    color = alt.Color("arm:N", title="Arm", scale=alt.Scale(domain=list(ARM_COLORS), range=list(ARM_COLORS.values())))
    x = alt.X("time:Q", title="Time (s)", scale=alt.Scale(domain=[0, float(analysis.stats.duration_s)]))
    lines = alt.Chart(data).mark_line(strokeWidth=2).encode(
        x=x,
        y=alt.Y("angle:Q", title="Elbow angle (°)", scale=alt.Scale(domain=[0, 180])),
        color=color,
        detail="segment:N",
        tooltip=[
            alt.Tooltip("arm:N", title="Arm"),
            alt.Tooltip("time:Q", title="Time (s)", format=".2f"),
            alt.Tooltip("angle:Q", title="Angle (°)", format=".0f"),
        ],
    )
    threshold = alt.Chart(pd.DataFrame({"y": [analysis.config.bent_angle_threshold]})).mark_rule(
        strokeDash=[4, 4], color="gray"
    ).encode(y="y:Q")
    layers = [lines, threshold]

    if analysis.observations:
        events = pd.DataFrame([
            {"start": e.start_s, "end": e.end_s, "arm": e.arm.capitalize()} for e in analysis.observations
        ])
        shading = alt.Chart(events).mark_rect(opacity=0.12, color="#9aa0a6").encode(
            x="start:Q", x2="end:Q", tooltip=[alt.Tooltip("arm:N", title="Observation (arm)")]
        )
        layers.insert(0, shading)
    return alt.layer(*layers).properties(height=320)


def _observation_card(event) -> None:
    with st.container(border=True):
        st.markdown(f"**{event.arm.capitalize()} arm · {format_time(event.start_s)} – {format_time(event.end_s)}**")
        cols = st.columns(4)
        cols[0].metric("Approx. elbow angle", f"{event.median_angle:.0f}°")
        cols[1].metric("Duration", f"{event.duration_s:.1f} s")
        cols[2].metric("Stillness", STILLNESS_LABELS[event.stillness])
        cols[3].metric("Tracking quality", event.tracking_quality.capitalize())
        st.markdown(f"**Measured:** {event.measurement_text}")
        st.markdown(f"**Suggestion:** {event.suggestion}")


def render_technique_analysis(result: ProcessingResult, config: AnalysisConfig, file_stem: str) -> None:
    st.divider()
    st.header("Technique Analysis")
    st.caption(
        f"{ANGLE_DISCLAIMER} Left and right are the climber's own left and right as estimated by MediaPipe. "
        "Bent arms are normal during many moves; observations below are cautious suggestions, not errors."
    )

    if not result.measurements:
        st.info("No pose measurements are available for this result. Click **Analyze Climb** to process the video again.")
        return
    if not result.pose_detected:
        st.warning("Technique analysis needs a detected climber, and no pose was found in this video.")
        return

    analysis = analyze(result.measurements, result.video_info.fps, config)
    stats = analysis.stats
    if not analysis.sufficient_data:
        st.warning(
            "Too few frames had a clearly visible shoulder, elbow and wrist for a reliable analysis "
            f"(left arm {stats.coverage_left:.0%}, right arm {stats.coverage_right:.0%} of frames). "
            "Results below may be incomplete. A steadier camera with the whole climber in view usually helps."
        )

    # A. Elbow angle chart
    st.subheader("Elbow angles over time")
    chart = _angle_chart(analysis)
    if chart is None:
        st.info("No valid elbow-angle measurements were found, so there is nothing to plot.")
    else:
        st.altair_chart(chart, width="stretch")
        st.caption(
            f"Smoothed measured angles. Gaps mean the arm was not tracked with enough confidence; "
            f"the dashed line is the {config.bent_angle_threshold:.0f}° bent-arm threshold, "
            "and shaded areas mark the observations below."
        )

    # B. Observations
    st.subheader("Technique observations")
    if analysis.observations:
        for event in analysis.observations:
            _observation_card(event)
    else:
        st.info(
            f"No sustained bent-arm periods (below {config.bent_angle_threshold:.0f}° for at least "
            f"{config.min_duration_s:.1f} s) were found in relatively still positions or where movement was unclear."
        )
    moving = [e for e in analysis.events if not e.flagged]
    if moving:
        with st.expander(f"{len(moving)} sustained bent-arm period(s) during active climbing (not flagged)"):
            st.caption("Bent arms are a normal part of many moves, so these are listed for reference only.")
            for event in moving:
                st.markdown(f"- {event.measurement_text}")

    # C. Statistics
    st.subheader("Analysis statistics")
    total_arm_frames = 2 * stats.total_frames
    row1, row2 = st.columns(2), st.columns(2)
    row1[0].metric("Video duration", format_time(stats.duration_s))
    row1[1].metric("Valid elbow measurements", f"{stats.valid_left + stats.valid_right:,} / {total_arm_frames:,}")
    row2[0].metric("Tracking coverage", f"{stats.coverage_any:.0%}")
    row2[1].metric("Bent-arm observations", f"{stats.observations}")
    st.caption(
        f"Left elbow measured in {stats.coverage_left:.0%} of frames, right elbow in {stats.coverage_right:.0%}. "
        "Tracking coverage is the share of frames where at least one elbow angle was measured."
    )

    # D. Downloads
    cols = st.columns(2)
    cols[0].download_button(
        "Download angle data (CSV)",
        data=analysis_to_csv(analysis, result.measurements),
        file_name=f"{file_stem}_elbow_angles.csv",
        mime="text/csv",
        on_click="ignore",
    )
    cols[1].download_button(
        "Download observations (JSON)",
        data=analysis_to_json(analysis),
        file_name=f"{file_stem}_observations.json",
        mime="application/json",
        on_click="ignore",
    )
