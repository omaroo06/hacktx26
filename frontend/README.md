# beta

Turn a photo of a real bouldering wall into a mapped route, get AI coaching on your climbing clips, learn from your crew, and step into the wall in VR.

## How the AI fits together

| Model | Role in beta | Where |
|---|---|---|
| **Gemini** (`gemini-3.8-flash`) | **The eyes.** Reads the wall photo and boxes every hold by color. Watches each climbing clip and writes a timestamped report of moves and technique, mapped to the numbered holds. | `server/gemini.ts` |
| **Muse Spark** (`muse-spark-1.3`, Meta Model API) | **The coach.** Turns Gemini's report (plus optional MediaPipe pose measurements) into personal feedback, writes the crew session (who should teach whom), and answers chat questions. | `server/muse.ts` |

The coach never sees the video itself. It only works from what Gemini reported, so every tip points to a real timestamp or hold.

API keys live only in the server. The browser talks to `/api/*`.

## Run it

Needs Node 20.19 or newer.

```bash
npm install
cp .env.example .env      # then paste your keys into .env
npm run dev               # web app on http://localhost:5173, API on :8787
```

Keys:

- `GEMINI_API_KEY`: from Google AI Studio. If Gemini answers with a 403, add an API restriction to the key in Google Cloud.
- `MODEL_API_KEY`: from dev.meta.ai → API keys (Meta Model API). The $50 HackTX credits apply here.

The Coach section shows a green dot next to each model when its key is loaded. Restart `npm run dev` after editing `.env`.

To serve everything from one port (for example on a demo laptop): `npm run build && npm start`, then open http://localhost:8787.

## Demo reliability

- If Gemini says it's overloaded (503 "high demand"), the server retries and then switches to the backup models in `GEMINI_FALLBACK_MODELS` (default: `gemini-3.6-flash`, then `gemini-3.5-flash-lite`).
- Good answers are saved in `server/.cache/`. The same wall photo or clip comes back instantly from the saved result. If Muse Spark is unreachable, the last good coaching for the same input is served instead.
- **Run your demo photo and clips once before judging.** Then the demo works even on bad Wi-Fi.
- To force fresh answers, delete `server/.cache/`.

## API

| Route | Input | Output |
|---|---|---|
| `GET /api/health` | | which keys and models are set |
| `POST /api/holds` | multipart `photo` | holds (normalized boxes, color, start/finish) and route colors |
| `POST /api/vision` | multipart `video`, optional `wallPhoto`, `route` (JSON) | timestamped report: moves, observations, visibility |
| `POST /api/coach` | JSON `{ climber, route, report, poseReport? }` | feedback: strengths, fixes with drills, next session |
| `POST /api/crew` | JSON `{ route, crew: [{ climber, report, feedback }] }` | recap, teach-each-other moments, pairings, plan, challenge |
| `POST /api/chat` | JSON `{ speaker, messages, route, crew }` | `{ reply }` |
| `POST /api/pose` | multipart `video` | forwards to `POSE_SERVICE_URL` (AI Mentor) |

Types for every request and response are in `src/types/coach.ts`.

## Hooking up the AI Mentor (MediaPipe)

To give the coach measured pose data, expose the pose pipeline as an endpoint that takes a multipart `video` field and returns the `observations.json` data, then set `POSE_SERVICE_URL` in `.env`. The web app calls it alongside Gemini for every clip. A FastAPI wrapper is about 15 lines:

```python
from fastapi import FastAPI, UploadFile
import tempfile, shutil

app = FastAPI()

@app.post("/analyze")
async def analyze(video: UploadFile):
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        shutil.copyfileobj(video.file, f)
    # Call the existing pipeline here and return its observations dict, e.g.:
    # return run_analysis(f.name)["observations"]
    ...
```

Run it with `uvicorn`, then set `POSE_SERVICE_URL=http://localhost:8000/analyze`.

## Data for Unity

The route ticket's "Peek at the route data" shows the route record, including each numbered hold's position normalized to the photo (`norm`, 0–1 from the top-left) and in photo pixels. To convert to wall meters (origin bottom-left, as in `src/types/wall.ts`), crop the photo to the wall first, then:

```
x_m = norm.x * wall_width_m
y_m = (1 - norm.y) * wall_height_m
```

## Project map

```
server/            API server (Express): Gemini + Muse Spark, cache, uploads
  index.ts         routes
  gemini.ts        hold detection + clip analysis
  muse.ts          coaching, crew session, chat
  prompts.ts       every prompt and JSON schema (bump PROMPT_VERSION after edits)
src/
  state/BetaSession.tsx      shared wall photo, route, detected holds
  services/api.ts            browser → /api calls
  services/holdDetection.ts  Gemini detector + hold numbering
  components/workspace/      wall upload, route picker, hold overlay
  components/coach/          crew cards, review, crew session, chat
  types/coach.ts             shared request/response types
```
