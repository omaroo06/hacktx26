"""Renders the Technique Analysis section with synthetic measurements to catch UI errors."""

from streamlit.testing.v1 import AppTest


def _render_script():
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path.cwd() / "tests"))
    from test_technique_analysis import FPS, bent_between, build

    from pose_analysis.technique_analysis import AnalysisConfig
    from pose_analysis.technique_ui import render_technique_analysis
    from pose_analysis.video_processor import ProcessingResult
    from pose_analysis.video_utils import VideoInfo

    measurements = build(
        8.0,
        left=bent_between(1.0, 3.5),
        right=bent_between(4.0, 6.5, angle=120),
        detected=lambda t: not (5.0 <= t < 5.1),
        offset=lambda t: (0.0, 0.0) if t < 4.0 else (0.0, 0.3 - 0.1 * (t - 4.0)),
    )
    result = ProcessingResult(
        video_info=VideoInfo(1000, 1000, FPS, False, len(measurements)),
        frames_processed=len(measurements),
        frames_with_pose=sum(m.pose_detected for m in measurements),
        processing_seconds=1.0,
        measurements=measurements,
    )
    render_technique_analysis(result, AnalysisConfig(), "synthetic")


def test_technique_section_renders():
    at = AppTest.from_function(_render_script, default_timeout=30).run()
    assert not at.exception, at.exception
    assert any(h.value == "Technique Analysis" for h in at.header)
    markdown = " ".join(m.value for m in at.markdown)
    assert "Left arm" in markdown and "**Measured:**" in markdown and "**Suggestion:**" in markdown
    metrics = {m.label: m.value for m in at.metric}
    assert metrics["Bent-arm observations"] == "1"
    assert metrics["Video duration"] == "8.0 s"
    # The right-arm period happens while the torso is moving, so it is listed but not flagged.
    assert any("during active climbing" in e.label for e in at.expander)
