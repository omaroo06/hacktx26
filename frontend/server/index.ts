/**
 * beta API server.
 *
 *   GET  /api/health   which models are configured
 *   POST /api/holds    wall photo → holds by color            (Gemini)
 *   POST /api/vision   climbing clip → timestamped report      (Gemini)
 *   POST /api/coach    report + profile → feedback             (Muse Spark)
 *   POST /api/crew     several climbers → crew recap           (Muse Spark)
 *   POST /api/chat     chat with the coach                     (Muse Spark)
 *   POST /api/pose     clip → MediaPipe report, if POSE_SERVICE_URL is set
 */

import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { ApiHealth, ChatRequest, CoachRequest, CrewRequest, HoldKind, RouteContext } from "../src/types/coach";
import { config, geminiReady, museReady } from "./config";
import { detectHolds, watchClimb } from "./gemini";
import { chat, coachClimber, crewRecap } from "./muse";
import { HOLD_COLOR_IDS } from "./prompts";
import { ApiError, clamp01 } from "./util";

await mkdir(config.uploadDir, { recursive: true });

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "4mb" }));

const MB = 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 300 * MB, files: 2 },
  fileFilter: (_req, file, cb) => {
    // Some browsers and phones send an empty or generic type, so fall back to the file extension.
    if (!file.mimetype || file.mimetype === "application/octet-stream") {
      file.mimetype = MIME_BY_EXT[path.extname(file.originalname).toLowerCase()] ?? file.mimetype;
    }
    const ok =
      (file.fieldname === "video" && file.mimetype.startsWith("video/")) ||
      ((file.fieldname === "photo" || file.fieldname === "wallPhoto") && file.mimetype.startsWith("image/"));
    if (ok) cb(null, true);
    else cb(new ApiError(415, `That ${file.fieldname === "video" ? "video" : "photo"} format isn't supported. Use MP4/MOV video or JPG/PNG photos.`));
  },
});

type Files = Record<string, Express.Multer.File[] | undefined>;

async function cleanup(req: Request) {
  const files = [...Object.values((req.files as Files) ?? {}).flat(), req.file].filter(Boolean) as Express.Multer.File[];
  await Promise.all(files.map((f) => unlink(f.path).catch(() => undefined)));
}

/** Validates the route the browser sends so prompts only ever see clean values. */
function parseRoute(value: unknown): RouteContext | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const color = (HOLD_COLOR_IDS as readonly string[]).includes(r.color as string) ? (r.color as RouteContext["color"]) : null;
  const kinds: HoldKind[] = ["hold", "start", "finish", "volume"];
  const holds = Array.isArray(r.holds)
    ? r.holds.slice(0, 60).map((h: Record<string, unknown>, i) => ({
        number: i + 1,
        x: clamp01(Number(h?.x) || 0),
        y: clamp01(Number(h?.y) || 0),
        kind: kinds.includes(h?.kind as HoldKind) ? (h.kind as HoldKind) : "hold",
      }))
    : [];
  return {
    color,
    name: String(r.name ?? "").slice(0, 60),
    grade: String(r.grade ?? "").slice(0, 12),
    holds,
  };
}

/* ==========================================================================
 * Routes
 * ========================================================================== */

app.get("/api/health", (_req, res) => {
  const health: ApiHealth = {
    gemini: { ready: geminiReady(), model: config.gemini.model },
    muse: { ready: museReady(), model: config.muse.model },
    pose: { ready: Boolean(config.poseServiceUrl) },
  };
  res.json(health);
});

app.post("/api/holds", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) throw new ApiError(400, "Attach a wall photo.");
    const result = await detectHolds(req.file.path, req.file.mimetype, req.query.fresh === "1");
    res.json(result);
  } finally {
    await cleanup(req);
  }
});

app.post(
  "/api/vision",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "wallPhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as Files;
      const video = files.video?.[0];
      const photo = files.wallPhoto?.[0];
      if (!video) throw new ApiError(400, "Attach a climbing video.");
      const { report, cached, model } = await watchClimb({
        videoPath: video.path,
        videoMime: video.mimetype,
        photoPath: photo?.path,
        photoMime: photo?.mimetype,
        route: parseRoute(req.body?.route),
        fresh: req.query.fresh === "1",
      });
      res.json({ report, model, cached });
    } finally {
      await cleanup(req);
    }
  },
);

app.post("/api/coach", async (req, res) => {
  const body = req.body as CoachRequest;
  if (!body?.climber || !body?.report) throw new ApiError(400, "Send a climber and their video report.");
  const { feedback, cached } = await coachClimber({ ...body, route: parseRoute(body.route) });
  res.json({ feedback, model: config.muse.model, cached });
});

app.post("/api/crew", async (req, res) => {
  const body = req.body as CrewRequest;
  const { crew, cached } = await crewRecap({ ...body, route: parseRoute(body?.route) });
  res.json({ crew, model: config.muse.model, cached });
});

app.post("/api/chat", async (req, res) => {
  const body = req.body as ChatRequest;
  const reply = await chat({ ...body, route: parseRoute(body?.route) });
  res.json({ reply, model: config.muse.model });
});

app.post("/api/pose", upload.single("video"), async (req, res) => {
  try {
    if (!config.poseServiceUrl) throw new ApiError(501, "The pose service isn't connected. Set POSE_SERVICE_URL in .env.");
    if (!req.file) throw new ApiError(400, "Attach a climbing video.");
    const { openAsBlob } = await import("node:fs");
    const form = new FormData();
    form.append("video", await openAsBlob(req.file.path, { type: req.file.mimetype }), req.file.originalname);
    const upstream = await fetch(config.poseServiceUrl, { method: "POST", body: form, signal: AbortSignal.timeout(240_000) }).catch(
      () => null,
    );
    if (!upstream?.ok) throw new ApiError(502, "The pose service didn't answer. Is the AI Mentor server running?");
    res.json(await upstream.json());
  } finally {
    await cleanup(req);
  }
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Unknown API route." });
});

/* ==========================================================================
 * Built web app (npm run build && npm start serves everything on one port)
 * ========================================================================== */

if (existsSync(config.distDir)) {
  app.use(express.static(config.distDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(config.distDir, "index.html")));
}

/* ==========================================================================
 * Errors
 * ========================================================================== */

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "That file is too big. Keep videos under 300 MB." : `Upload problem: ${err.message}`;
    res.status(413).json({ error: message });
    return;
  }
  if ((err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "That request is too large." });
    return;
  }
  console.error("[beta] Unexpected error:", err);
  res.status(500).json({ error: "Something went wrong on the beta server. Check the terminal for details." });
});

app.listen(config.port, () => {
  const mark = (ok: boolean) => (ok ? "ready" : "missing key");
  console.log(`\n  beta API  →  http://localhost:${config.port}`);
  console.log(`  Gemini (${config.gemini.model}): ${mark(geminiReady())}`);
  console.log(`  Muse Spark (${config.muse.model}): ${mark(museReady())}`);
  if (config.poseServiceUrl) console.log(`  Pose service: ${config.poseServiceUrl}`);
  console.log("");
});
