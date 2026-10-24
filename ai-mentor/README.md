# beta | AI Mentor — Video Pose Estimation and Elbow-Angle Analysis

Upload a climbing video, run MediaPipe Pose Landmarker on every frame, and watch or download
the video with the detected body skeleton drawn over the climber. Phase 2 adds elbow-angle
measurement and detection of sustained bent-arm positions.

**Workflow:** Upload MP4 → Analyze Climb → View annotated video → Download → Technique Analysis

## Requirements

- Windows 11, PowerShell
- Python **3.11** (installed via the python.org installer, which provides the `py` launcher)
- Internet access on first run (to download the pose model once)

FFmpeg does **not** need to be installed: the `imageio-ffmpeg` package bundles an FFmpeg binary
that is used to encode browser-compatible H.264 MP4 output.

## Setup and run (PowerShell)

Run these from the project folder (`beta-ai-mentor`).

```powershell
# 1. Check that Python 3.11 is available
py -3.11 --version

# 2. Create a virtual environment (an isolated folder of packages for this project)
py -3.11 -m venv .venv

# 3. Activate it (your prompt will start with "(.venv)")
.\.venv\Scripts\Activate.ps1

# 4. Install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 5. (Optional) download the pose model now instead of on first analysis
python backend\pose_analysis\download_model.py

# 6. Start the app
streamlit run backend\pose_analysis\app.py
```

The app opens at <http://localhost:8501>. If the browser doesn't open automatically, run
`Start-Process http://localhost:8501`.

Stop the app with **Ctrl+C** in the PowerShell window. Leave the virtual environment with `deactivate`.

If activation fails with "running scripts is disabled on this system", run this once, then retry step 3:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Next time, you only need steps 3 and 6.

## Run the tests

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest
```

## Project structure

```
beta-ai-mentor/
├── backend/pose_analysis/
│   ├── app.py              # Streamlit UI only
│   ├── detector.py         # Model download, Pose Landmarker (VIDEO mode), skeleton drawing
│   ├── video_processor.py  # Decode -> detect -> draw -> encode pipeline + stats
│   ├── video_utils.py      # Validation, FPS fallback, timestamps, H.264 writer, camera-motion estimate
│   ├── technique_analysis.py  # Elbow angles, smoothing, stillness, bent-arm detection, CSV/JSON export
│   ├── technique_ui.py     # Streamlit "Technique Analysis" section
│   ├── download_model.py   # Optional: pre-download the model
│   └── models/             # Downloaded .task model files (git-ignored)
├── tests/                  # pytest tests
├── requirements.txt
├── pytest.ini
└── .gitignore
```

## How it works

- **Decoding:** OpenCV reads the MP4. The first frame is decoded during validation; frame size is
  taken from the decoded frame so phone rotation metadata is respected.
- **Pose detection:** MediaPipe Pose Landmarker Tasks API in `VIDEO` running mode, `num_poses=1`,
  confidence thresholds 0.5. Frames are converted BGR→RGB and passed to `detect_for_video()` with
  timestamps `frame_index * 1000 / fps` (ms), forced to be strictly increasing.
- **Drawing:** Only landmarks with visibility ≥ 0.5 that lie inside the frame are drawn, and a bone
  is drawn only if both endpoints are visible. Frames with no detection are written unchanged —
  nothing is interpolated or invented.
- **Encoding:** Frames are piped to the bundled FFmpeg and encoded as H.264 (`libx264`, `yuv420p`,
  `+faststart`) at the original FPS and size (odd dimensions are padded by 1 px, as H.264/yuv420p requires).
- **FPS fallback:** if the video reports a missing or implausible frame rate (outside 1–240 fps),
  30 fps is assumed and a warning is shown.
- **Audio:** the annotated video has **no audio** in this milestone.

## Technique analysis (Phase 2)

Measurements are recorded during the same processing pass that draws the skeleton, so MediaPipe
runs only once. Changing the analysis settings in the sidebar re-runs the analysis on the stored
measurements instantly.

- **Elbow angle:** the angle at the elbow between the shoulder→elbow and wrist→elbow vectors,
  computed with NumPy in image **pixel** coordinates (cosine clamped to [-1, 1]). 180° is a
  straight arm. These are **2D projected angles**, not exact 3D anatomical angles; they change
  with camera viewpoint.
- **Validity:** an angle counts only if shoulder, elbow and wrist are inside the frame and all have
  visibility ≥ the minimum (default 0.6). Otherwise the frame is recorded as "no measurement".
- **Smoothing:** a centered median filter (~0.2 s) applied only within uninterrupted runs of valid
  frames. Gaps are never filled.
- **Sustained bent arm (per arm):** starts when the smoothed angle drops below the threshold
  (default 140°), ends when the arm opens past threshold + 5° or tracking is lost for more than
  0.3 s, and is reported only if it lasts at least the minimum duration (default 1.5 s).
- **Movement:** each bent-arm period is labelled *stationary*, *moving* (active climbing), or
  *uncertain*. Speeds are measured over a 0.5 s window, in torso lengths per second of video time
  (independent of resolution, camera distance and frame rate). Missing landmarks are never treated
  as zero movement.
  - *Hand/foot motion* — wrists and ankles relative to the torso. Camera panning does not change
    these, so they reveal reaches and steps even when the camera follows the climber.
  - *Whole-body motion* — torso center relative to the wall (background optical flow subtracted).
    Used only when the camera is steady enough.
  - *Camera motion* — median Lucas-Kanade flow of wall texture, excluding the climber's bounding
    box. If the camera is moving too much and no reach/step is seen, the label is *uncertain*.
  - *moving* if the interior of the period (edges ignored, so the arm folding into a bent
    position is not itself a “move”) has a reach, step or body translation: at least 20% of
    frames, one ≥ 0.25 s episode, or a hand/foot spike ≥ 1.0 torso lengths/s. Listed for
    reference only; no straight-arm suggestion.
  - *stationary* only when hands, feet and torso all moved little *and* enough of them were
    tracked. This is the only case that suggests relaxing into a straighter arm.
  - *uncertain* when tracking or camera motion is too poor to decide. No technique suggestion.
- **Observations** are shown for *stationary* and *uncertain* events, with the measured facts
  and the coaching suggestion displayed separately.
- **Exports:** per-frame CSV (raw and smoothed angles, visibility, validity, limb/body/camera
  speeds) and JSON (settings, summary statistics, events).

All thresholds are initial heuristics, not established climbing science.

## Pose model

Official MediaPipe Pose Landmarker models
([documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models)):

- Lite (default): https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task
- Full: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
- Heavy: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task

Lite is the default because it runs quickly on a laptop CPU. Full/Heavy can be selected in the
app's sidebar and may track climbers better in difficult poses, at the cost of speed. Each model is
downloaded once into `backend/pose_analysis/models/` and reused afterwards. If the download fails
(e.g. offline), download the file manually from the URL above and save it in that folder as
`pose_landmarker_lite.task` (or `_full` / `_heavy`).

## Known limitations

- No audio in the output video.
- The original-video preview may not play for codecs the browser doesn't support (e.g. some iPhone
  HEVC videos); analysis still works if OpenCV can decode the file.
- Processing happens in memory within the Streamlit session; very long or high-resolution videos
  take longer and use more memory (upload limit: 200 MB).
