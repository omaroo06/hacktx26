"""Download the official MediaPipe Pose Landmarker model ahead of time.

Usage (from the project root):
    python backend/pose_analysis/download_model.py          # lite (default)
    python backend/pose_analysis/download_model.py full
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pose_analysis.detector import DEFAULT_MODEL, MODEL_URLS, ModelError, ensure_model  # noqa: E402


def main() -> int:
    variant = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL
    if variant not in MODEL_URLS:
        print(f"Unknown model '{variant}'. Choose one of: {', '.join(MODEL_URLS)}")
        return 1
    try:
        path = ensure_model(variant)
    except ModelError as exc:
        print(f"Error: {exc}")
        return 1
    print(f"Model ready: {path} ({path.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
