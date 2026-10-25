/**
 * Gemini = beta's eyes: reads wall photos and watches climbing clips.
 */

import { readFile, stat } from "node:fs/promises";
import { GoogleGenAI, createPartFromBase64, createPartFromUri, createUserContent, type Part } from "@google/genai";
import type { DetectHoldsResponse, DetectedHold, RouteContext, VisionReport } from "../src/types/coach";
import type { HoldColorId } from "../src/types/wall";
import { config, geminiReady } from "./config";
import {
  DETECT_HOLDS_PROMPT,
  HOLD_COLOR_IDS,
  PROMPT_VERSION,
  detectHoldsSchema,
  visionPrompt,
  visionSchema,
} from "./prompts";
import { ApiError, clamp01, formatTimestamp, hashFile, hashValue, parseJsonLoose, parseTimestamp, readCache, writeCache } from "./util";

/** Files above this size go through the Files API instead of inline bytes. */
const INLINE_LIMIT_BYTES = 14 * 1024 * 1024;

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!geminiReady()) {
    throw new ApiError(503, "Gemini isn't set up yet. Add GEMINI_API_KEY to the .env file and restart the server.");
  }
  client ??= new GoogleGenAI({
    apiKey: config.gemini.apiKey,
    // Retries are handled in generateJson so a busy model can hand off to a backup quickly.
    httpOptions: {
      timeout: 180_000,
      retryOptions: { attempts: 1 },
      ...(config.gemini.baseUrl ? { baseUrl: config.gemini.baseUrl } : {}),
    },
  });
  return client;
}

/** Gemini lists QuickTime as video/mov. */
function normalizeMime(mime: string): string {
  if (mime === "video/quicktime") return "video/mov";
  return mime || "application/octet-stream";
}

/** Uploads a file through the Files API and waits until Gemini can read it. */
async function uploadAndWait(filePath: string, mimeType: string): Promise<Part> {
  const ai = gemini();
  const uploaded = await withRetry("upload", () => ai.files.upload({ file: filePath, config: { mimeType: normalizeMime(mimeType) } }));
  let file = uploaded;
  const deadline = Date.now() + 180_000;

  while (file.state === "PROCESSING") {
    if (Date.now() > deadline) throw new ApiError(504, "Gemini took too long to process the video. Try a shorter clip.");
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: uploaded.name! });
  }

  if (file.state === "FAILED" || !file.uri) {
    throw new ApiError(422, "Gemini couldn't read that file. Try exporting it as an MP4.");
  }
  return createPartFromUri(file.uri, file.mimeType ?? normalizeMime(mimeType));
}

async function filePart(filePath: string, mimeType: string): Promise<Part> {
  const { size } = await stat(filePath);
  if (size <= INLINE_LIMIT_BYTES) {
    const data = (await readFile(filePath)).toString("base64");
    return createPartFromBase64(data, normalizeMime(mimeType));
  }
  return uploadAndWait(filePath, mimeType);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statusOf(err: unknown): number {
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : 0;
}

/** Pulls the readable part out of Google's JSON error text. */
function shortMessage(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? String(err);
  const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
  return (m ? m[1] : raw).replace(/key=[\w-]+/gi, "key=***").slice(0, 200);
}

/** "Busy, try again" errors, as opposed to "this request is wrong". */
function isRetryable(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const status = statusOf(err);
  if (status) return [408, 429, 500, 502, 503, 504].includes(status);
  return /UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET|ETIMEDOUT/i.test(shortMessage(err));
}

async function withRetry<T>(label: string, run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (err) {
      if (i >= attempts || !isRetryable(err)) throw toApiError(err);
      console.warn(`[beta] Gemini ${label} busy (try ${i}): ${shortMessage(err)}`);
      await wait(1500 * i);
    }
  }
}

/**
 * Asks Gemini for JSON. When a model is busy (503 "high demand", 429), it tries
 * again once, then hands off to the next model in GEMINI_FALLBACK_MODELS.
 */
async function generateJson<T>(parts: Part[], schema: unknown): Promise<{ data: T; model: string }> {
  const models = [config.gemini.model, ...config.gemini.fallbackModels.filter((m) => m !== config.gemini.model)];
  let lastError: unknown = null;
  let lastModel = config.gemini.model;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await gemini().models.generateContent({
          model,
          contents: createUserContent(parts),
          config: { responseMimeType: "application/json", responseJsonSchema: schema },
        });
        const text = response.text;
        if (!text) throw new ApiError(502, "Gemini returned an empty answer. Try again.");
        const data = parseJsonLoose<T>(text);
        if (model !== config.gemini.model) console.warn(`[beta] ${config.gemini.model} was busy, so ${model} answered.`);
        return { data, model };
      } catch (err) {
        lastError = err;
        lastModel = model;
        if (statusOf(err) === 404) break; // this key can't use this model; try the next one
        if (!isRetryable(err)) throw toApiError(err, model);
        console.warn(`[beta] ${model} busy (try ${attempt}): ${shortMessage(err)}`);
        if (attempt < 2) await wait(2500);
      }
    }
  }
  throw toApiError(lastError, lastModel);
}

function toApiError(err: unknown, model = config.gemini.model): ApiError {
  if (err instanceof ApiError) return err;
  const status = statusOf(err);
  const detail = shortMessage(err);
  console.error(`[beta] Gemini error ${status}: ${detail}`);
  if (status === 400 && /api key/i.test(detail)) return new ApiError(401, "Gemini rejected the API key. Check GEMINI_API_KEY in .env.");
  if (status === 401 || status === 403) {
    return new ApiError(401, "Gemini refused the request (403). Check that GEMINI_API_KEY is valid and has an API restriction set in Google Cloud.");
  }
  if (status === 404) return new ApiError(502, `Gemini doesn't know the model "${model}". Check GEMINI_MODEL in .env.`);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail)) {
    return new ApiError(429, "Gemini's rate limit or free quota is used up for the moment. Wait a minute and try again.");
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(detail)) {
    return new ApiError(503, "Gemini is overloaded right now (that's on Google's side), and the backup models were busy too. Wait a minute and click Try again.");
  }
  if (err instanceof SyntaxError) return new ApiError(502, "Gemini's answer wasn't valid JSON. Try again.");
  return new ApiError(502, `Gemini had a problem: ${detail}`);
}

/* ==========================================================================
 * Wall photo → holds
 * ========================================================================== */

interface RawHolds {
  routeColors?: string[];
  holds?: { box_2d?: number[]; color?: string; kind?: string }[];
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

const isColor = (c: unknown): c is HoldColorId => typeof c === "string" && (HOLD_COLOR_IDS as readonly string[]).includes(c);

export async function detectHolds(photoPath: string, mimeType: string, fresh = false): Promise<DetectHoldsResponse> {
  const key = hashValue([PROMPT_VERSION, config.gemini.model, await hashFile(photoPath)]);
  if (!fresh) {
    const hit = await readCache<DetectHoldsResponse>("holds", key);
    if (hit) return { ...hit, cached: true };
  }

  const { data: raw, model } = await generateJson<RawHolds>(
    [await filePart(photoPath, mimeType), { text: DETECT_HOLDS_PROMPT }],
    detectHoldsSchema,
  );

  const holds: DetectedHold[] = [];
  for (const h of raw.holds ?? []) {
    if (!isColor(h.color) || !Array.isArray(h.box_2d) || h.box_2d.length !== 4) continue;
    const [ymin, xmin, ymax, xmax] = h.box_2d.map((n) => clamp01(Number(n) / 1000));
    if (!(xmax > xmin && ymax > ymin)) continue;
    holds.push({
      color: h.color,
      kind: h.kind === "start" || h.kind === "finish" || h.kind === "volume" ? h.kind : "hold",
      x: round4((xmin + xmax) / 2),
      y: round4((ymin + ymax) / 2),
      w: round4(xmax - xmin),
      h: round4(ymax - ymin),
    });
  }

  // Trust the holds themselves over the model's list when they disagree.
  const counts = new Map<HoldColorId, number>();
  for (const h of holds) counts.set(h.color, (counts.get(h.color) ?? 0) + 1);
  const listed = (raw.routeColors ?? []).filter(isColor).filter((c) => (counts.get(c) ?? 0) >= 2);
  const extra = [...counts.entries()].filter(([c, n]) => n >= 3 && !listed.includes(c)).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const routeColors = [...new Set([...listed, ...extra])];

  const result: DetectHoldsResponse = { holds, routeColors, model, cached: false };
  await writeCache("holds", key, result);
  return result;
}

/* ==========================================================================
 * Climbing clip → vision report
 * ========================================================================== */

interface RawVision {
  summary?: string;
  outcome?: string;
  durationSeconds?: number;
  sameWall?: string;
  visibility?: { quality?: string; notes?: string };
  moves?: { t?: string; limb?: string; action?: string; holdNumber?: number }[];
  observations?: {
    t?: string;
    category?: string;
    tone?: string;
    detail?: string;
    holdNumber?: number;
    confidence?: string;
  }[];
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export interface WatchClimbInput {
  videoPath: string;
  videoMime: string;
  photoPath?: string;
  photoMime?: string;
  route: RouteContext | null;
  fresh?: boolean;
}

export async function watchClimb(input: WatchClimbInput): Promise<{ report: VisionReport; cached: boolean; model: string }> {
  const hasPhoto = Boolean(input.photoPath && input.route?.holds.length);
  const key = hashValue([
    PROMPT_VERSION,
    config.gemini.model,
    await hashFile(input.videoPath),
    hasPhoto ? await hashFile(input.photoPath!) : null,
    input.route,
  ]);

  if (!input.fresh) {
    const hit = await readCache<VisionReport>("vision", key);
    if (hit) return { report: hit, cached: true, model: config.gemini.model };
  }

  const parts: Part[] = [];
  if (hasPhoto) parts.push(await filePart(input.photoPath!, input.photoMime ?? "image/jpeg"));
  parts.push(await uploadAndWait(input.videoPath, input.videoMime));
  parts.push({ text: visionPrompt(input.route, hasPhoto) });

  const { data: raw, model } = await generateJson<RawVision>(parts, visionSchema);
  const report = normalizeVision(raw, input.route);
  await writeCache("vision", key, report);
  return { report, cached: false, model };
}

function normalizeVision(raw: RawVision, route: RouteContext | null): VisionReport {
  const maxHold = route?.holds.length ?? 0;
  const duration = Number(raw.durationSeconds) > 0 ? Number(raw.durationSeconds) : 0;
  const holdOf = (n: unknown) => {
    const v = Math.round(Number(n));
    return v >= 1 && v <= maxHold ? v : null;
  };
  // Don't clamp to the model's duration estimate; it can be a few seconds short.
  const timeOf = (t: unknown) => {
    const s = parseTimestamp(typeof t === "string" ? t : null);
    return s === null || s < 0 ? null : s;
  };

  const moves = (raw.moves ?? []).flatMap((m) => {
    const seconds = timeOf(m.t);
    if (seconds === null || !m.action) return [];
    return [
      {
        t: formatTimestamp(seconds),
        seconds,
        limb: pick(m.limb, ["left hand", "right hand", "left foot", "right foot", "body"] as const, "body"),
        action: m.action,
        holdNumber: holdOf(m.holdNumber),
      },
    ];
  });

  const observations = (raw.observations ?? []).flatMap((o) => {
    const seconds = timeOf(o.t);
    if (seconds === null || !o.detail) return [];
    return [
      {
        t: formatTimestamp(seconds),
        seconds,
        category: pick(
          o.category,
          ["footwork", "hips", "arms", "balance", "pacing", "route-reading", "dynamic", "rest"] as const,
          "pacing",
        ),
        tone: pick(o.tone, ["strength", "issue", "note"] as const, "note"),
        detail: o.detail,
        holdNumber: holdOf(o.holdNumber),
        confidence: pick(o.confidence, ["high", "medium", "low"] as const, "medium"),
      },
    ];
  });

  return {
    summary: raw.summary?.trim() || "Gemini watched the clip but didn't write a summary.",
    outcome: pick(raw.outcome, ["sent", "fell", "stepped off", "unclear"] as const, "unclear"),
    durationSeconds: duration,
    sameWallAsPhoto: raw.sameWall === "yes" ? true : raw.sameWall === "no" ? false : null,
    visibility: {
      quality: pick(raw.visibility?.quality, ["good", "partial", "poor"] as const, "partial"),
      notes: raw.visibility?.notes?.trim() ?? "",
    },
    moves: moves.sort((a, b) => a.seconds - b.seconds),
    observations: observations.sort((a, b) => a.seconds - b.seconds),
  };
}
