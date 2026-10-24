"""Streamlit UI for beta | AI Mentor.

Run from the project root:
    streamlit run backend/pose_analysis/app.py
"""

from __future__ import annotations

import logging
import sys
import tempfile
import time
from pathlib import Path

import streamlit as st

# Streamlit runs this file as a script, so make the `pose_analysis` package importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pose_analysis.detector import DEFAULT_MODEL, MODEL_URLS, ModelError, ensure_model  # noqa: E402
from pose_analysis.technique_ui import analysis_settings, render_technique_analysis  # noqa: E402
from pose_analysis.video_processor import ProcessingResult, process_video  # noqa: E402
from pose_analysis.video_utils import (  # noqa: E402
    VideoEncodingError,
    VideoInfo,
    VideoValidationError,
    check_extension,
    probe_video,
)

logger = logging.getLogger("beta.ai_mentor")

MODEL_LABELS = {
    "lite": "Lite (fastest, recommended for CPU)",
    "full": "Full (more accurate, slower)",
    "heavy": "Heavy (most accurate, slowest)",
}


def init_state() -> None:
    defaults = {
        "file_id": None,
        "video_info": None,
        "validation_error": None,
        "processing": False,
        "result": None,
        "output_bytes": None,
        "output_name": None,
        "error": None,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


def reset_for_new_file(file_id: str | None) -> None:
    st.session_state.update(
        file_id=file_id, video_info=None, validation_error=None,
        result=None, output_bytes=None, output_name=None, error=None,
    )


def write_upload(uploaded_file, directory: str) -> Path:
    path = Path(directory) / "input.mp4"
    path.write_bytes(uploaded_file.getvalue())
    return path


def validate_upload(uploaded_file) -> None:
    """Validate the upload once per file and cache the outcome in session state."""
    try:
        check_extension(uploaded_file.name)
        if uploaded_file.size == 0:
            raise VideoValidationError("The uploaded file is empty.")
        with tempfile.TemporaryDirectory(prefix="beta_validate_") as tmp:
            st.session_state.video_info = probe_video(write_upload(uploaded_file, tmp))
    except VideoValidationError as exc:
        st.session_state.validation_error = str(exc)
    except OSError as exc:
        st.session_state.validation_error = f"Could not save the upload to a temporary file: {exc}"


def start_processing() -> None:
    st.session_state.processing = True
    st.session_state.error = None
    st.session_state.result = None
    st.session_state.output_bytes = None


def run_processing(uploaded_file, model_variant: str) -> None:
    status = st.empty()
    progress = st.progress(0.0, text="Starting...")
    try:
        status.info("Loading the MediaPipe pose model (downloaded once on first use)...")
        ensure_model(model_variant)

        status.info("Analyzing your climb frame by frame...")
        last_update = 0.0

        def on_progress(done: int, total: int) -> None:
            nonlocal last_update
            now = time.monotonic()
            if now - last_update < 0.15 and done < total:
                return
            last_update = now
            fraction = min(done / total, 1.0) if total else 0.0
            progress.progress(fraction, text=f"Processed {done} / {total} frames ({fraction:.0%})")

        with tempfile.TemporaryDirectory(prefix="beta_process_") as tmp:
            input_path = write_upload(uploaded_file, tmp)
            output_path = Path(tmp) / "annotated.mp4"
            result = process_video(input_path, output_path, model_variant, on_progress)
            st.session_state.output_bytes = output_path.read_bytes()

        st.session_state.result = result
        st.session_state.output_name = f"{Path(uploaded_file.name).stem}_pose.mp4"
    except VideoValidationError as exc:
        st.session_state.error = f"Video problem: {exc}"
    except ModelError as exc:
        st.session_state.error = f"Pose model problem: {exc}"
    except VideoEncodingError as exc:
        st.session_state.error = f"Could not create the annotated video: {exc}"
    except OSError as exc:
        st.session_state.error = f"A temporary file operation failed: {exc}"
    except Exception as exc:  # noqa: BLE001 - last-resort friendly message
        logger.exception("Unexpected processing error")
        st.session_state.error = f"An unexpected error occurred while processing the video ({type(exc).__name__}: {exc})."
    finally:
        st.session_state.processing = False
        status.empty()
        progress.empty()


def show_video_info(info: VideoInfo) -> None:
    cols = st.columns(3)
    cols[0].metric("Resolution", f"{info.width} x {info.height}")
    cols[1].metric("Frame rate", f"{info.fps:.1f} fps")
    cols[2].metric("Frames (approx.)", f"{info.frame_count:,}" if info.frame_count else "Unknown")
    if info.fps_is_fallback:
        st.warning(
            "This video does not report a valid frame rate, so 30 fps is assumed. "
            "Playback speed of the annotated video may differ slightly from the original."
        )


def show_results(result: ProcessingResult) -> None:
    st.subheader("Results")
    cols = st.columns(3)
    cols[0].metric("Frames processed", f"{result.frames_processed:,}")
    cols[1].metric("Frames with a detected pose", f"{result.frames_with_pose:,}")
    cols[2].metric("Detection rate", f"{result.detection_rate:.0%}")
    st.caption(f"Processing time: {result.processing_seconds:.1f} s")

    if not result.pose_detected:
        st.error(
            "No person was detected in any frame, so no skeleton was drawn. "
            "Try a video where the climber's full body is clearly visible and well lit."
        )
    elif result.detection_rate < 0.5:
        st.warning(
            "A pose was detected in fewer than half of the frames. Tracking may be unreliable; "
            "frames without a detection are shown without a skeleton."
        )
    else:
        st.success("Pose tracking complete.")

    st.video(st.session_state.output_bytes, format="video/mp4")
    st.download_button(
        "Download annotated video",
        data=st.session_state.output_bytes,
        file_name=st.session_state.output_name,
        mime="video/mp4",
    )
    st.caption("The annotated video does not include the original audio.")


def main() -> None:
    st.set_page_config(page_title="beta | AI Mentor", layout="centered")
    init_state()

    st.title("beta | AI Mentor")
    st.write("Upload a climbing video to visualize your body movements.")

    with st.sidebar:
        st.header("Settings")
        model_variant = st.selectbox(
            "Pose model",
            options=list(MODEL_URLS),
            index=list(MODEL_URLS).index(DEFAULT_MODEL),
            format_func=MODEL_LABELS.get,
            disabled=st.session_state.processing,
        )
        st.caption("Models are official MediaPipe Pose Landmarker assets, downloaded once on first use.")
        analysis_config = analysis_settings(disabled=st.session_state.processing)

    st.markdown(
        "**Instructions:** upload an MP4 video (for example, from your phone) showing one climber. "
        "Best results come from a steady camera with the climber's whole body in view."
    )
    uploaded = st.file_uploader(
        "Choose an MP4 climbing video", type=["mp4"], disabled=st.session_state.processing
    )

    if uploaded is None:
        if st.session_state.file_id is not None:
            reset_for_new_file(None)
        st.info("No video uploaded yet.")
        return

    if uploaded.file_id != st.session_state.file_id:
        reset_for_new_file(uploaded.file_id)
        validate_upload(uploaded)

    if st.session_state.validation_error:
        st.error(st.session_state.validation_error)
        return

    st.subheader("Original video")
    st.video(uploaded.getvalue(), format="video/mp4")
    st.caption(
        "If this preview does not play, your browser may not support the video's codec "
        "(e.g. some iPhone HEVC videos). Analysis still works, and the result is browser-compatible H.264."
    )
    show_video_info(st.session_state.video_info)

    st.button(
        "Analyze Climb",
        type="primary",
        width="stretch",
        disabled=st.session_state.processing,
        on_click=start_processing,
    )

    if st.session_state.processing:
        run_processing(uploaded, model_variant)
        st.rerun()

    if st.session_state.error:
        st.error(st.session_state.error)
    elif st.session_state.result is not None:
        show_results(st.session_state.result)
        render_technique_analysis(
            st.session_state.result, analysis_config, Path(st.session_state.output_name).stem.removesuffix("_pose")
        )


main()
