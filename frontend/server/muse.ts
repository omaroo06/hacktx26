/**
 * Muse Spark (Meta Model API) = beta's coach.
 * Uses the OpenAI-compatible Chat Completions endpoint with plain fetch, so no extra SDK is needed.
 */

import type {
  ChatRequest,
  ClimberDossier,
  CoachFeedback,
  CoachRequest,
  CrewRecap,
  CrewRequest,
} from "../src/types/coach";
import { config, museReady } from "./config";
import {
  COACH_SYSTEM,
  CREW_SYSTEM,
  PROMPT_VERSION,
  chatSystem,
  coachSchema,
  crewSchema,
  describeClimber,
  describeRouteForCoach,
} from "./prompts";
import { ApiError, compactJson, formatTimestamp, hashValue, parseJsonLoose, parseTimestamp, readCache, writeCache } from "./util";

type Role = "developer" | "user" | "assistant";
interface MuseMessage {
  role: Role;
  content: string;
}

interface MuseCallOptions {
  messages: MuseMessage[];
  schema?: { name: string; schema: unknown };
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  maxTokens?: number;
}

// max_completion_tokens includes reasoning tokens, so leave generous room.
async function callMuse({ messages, schema, reasoningEffort = "low", maxTokens = 8000 }: MuseCallOptions): Promise<string> {
  if (!museReady()) {
    throw new ApiError(503, "Muse Spark isn't set up yet. Add MODEL_API_KEY (your Meta Model API key) to the .env file and restart the server.");
  }

  const body: Record<string, unknown> = {
    model: config.muse.model,
    messages,
    reasoning_effort: reasoningEffort,
    max_completion_tokens: maxTokens,
  };
  if (schema) body.response_format = { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema } };

  let res: Response;
  try {
    res = await fetch(`${config.muse.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.muse.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    throw new ApiError(504, timedOut ? "Muse Spark took too long to answer. Try again." : "Couldn't reach the Meta Model API. Check your internet connection.");
  }

  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 400);
    console.error(`[beta] Muse error ${res.status}: ${text}`);
    // If the endpoint doesn't accept the schema, retry once and ask for JSON in words instead.
    if (res.status === 400 && schema && /response_format|json_schema|schema/i.test(text)) {
      const fallback = [...messages];
      fallback[0] = {
        ...fallback[0],
        content: `${fallback[0].content}\n\nReply with ONLY a JSON object matching this JSON Schema, no prose:\n${JSON.stringify(schema.schema)}`,
      };
      return callMuse({ messages: fallback, reasoningEffort, maxTokens });
    }
    if (res.status === 401 || res.status === 403) throw new ApiError(401, "The Meta Model API rejected the key. Check MODEL_API_KEY in .env.");
    if (res.status === 404) throw new ApiError(502, `The Meta Model API doesn't know the model "${config.muse.model}". Set MUSE_MODEL in .env.`);
    if (res.status === 429) throw new ApiError(429, "Muse Spark is rate limiting us, or the credits ran out. Wait a moment and try again.");
    throw new ApiError(502, `Muse Spark had a problem (${res.status}). Try again.`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((p) => p.text ?? "").join("") : (content ?? "");
  if (!text.trim()) throw new ApiError(502, "Muse Spark returned an empty answer. Try again.");
  return text;
}

async function callMuseJson<T>(options: MuseCallOptions): Promise<T> {
  const text = await callMuse(options);
  try {
    return parseJsonLoose<T>(text);
  } catch {
    throw new ApiError(502, "Muse Spark's answer wasn't valid JSON. Try again.");
  }
}

/** Calls the model; if it fails, falls back to the last good answer for the same input. */
async function withFallback<T>(bucket: string, key: string, run: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
  try {
    const value = await run();
    await writeCache(bucket, key, value);
    return { value, cached: false };
  } catch (err) {
    const saved = await readCache<T>(bucket, key);
    if (saved) {
      console.warn(`[beta] Muse failed (${(err as Error).message}); serving the saved ${bucket} answer.`);
      return { value: saved, cached: true };
    }
    throw err;
  }
}

/** Trims a report to what the coach needs, so prompts stay small. */
function evidenceFor(dossier: ClimberDossier) {
  return {
    climber: describeClimber(dossier.climber),
    videoReport: {
      summary: dossier.report.summary,
      outcome: dossier.report.outcome,
      durationSeconds: dossier.report.durationSeconds,
      visibility: dossier.report.visibility,
      moves: dossier.report.moves.map(({ t, limb, action, holdNumber }) => ({ t, limb, action, holdNumber })),
      observations: dossier.report.observations.map(({ t, category, tone, detail, holdNumber, confidence }) => ({
        t,
        category,
        tone,
        detail,
        holdNumber,
        confidence,
      })),
    },
    coachingNotes: dossier.feedback
      ? {
          headline: dossier.feedback.headline,
          strengths: dossier.feedback.strengths.map((s) => `${s.title}${s.t ? ` (${s.t})` : ""}`),
          fixes: dossier.feedback.fixes.map((f) => `${f.title}${f.t ? ` (${f.t})` : ""}`),
        }
      : null,
  };
}

/** Keeps the AI Mentor's pose report small enough for a prompt without breaking its JSON. */
function trimPoseReport(pose: unknown): unknown {
  if (pose === undefined || pose === null) return null;
  const text = JSON.stringify(pose);
  if (text.length <= 8000) return pose;
  if (typeof pose === "object" && !Array.isArray(pose)) {
    const trimmed = Object.fromEntries(
      Object.entries(pose as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? v.slice(0, 30) : v]),
    );
    if (JSON.stringify(trimmed).length <= 12000) return trimmed;
  }
  return { note: "The pose report was too large, so only the start is included.", excerpt: text.slice(0, 8000) };
}

function withSeconds<T extends { t: string | null }>(item: T): T & { seconds: number | null } {
  const seconds = parseTimestamp(item.t);
  return { ...item, t: seconds === null ? null : formatTimestamp(seconds), seconds };
}

/* ==========================================================================
 * One climber → feedback
 * ========================================================================== */

export async function coachClimber(req: CoachRequest): Promise<{ feedback: CoachFeedback; cached: boolean }> {
  if (!req.report) throw new ApiError(400, "Missing the video report to coach from.");

  const evidence = {
    route: describeRouteForCoach(req.route),
    ...evidenceFor({ climber: req.climber, report: req.report, feedback: null }),
    poseMeasurements: trimPoseReport(req.poseReport),
  };
  const evidenceText = JSON.stringify(evidence, null, 1);

  const key = hashValue([PROMPT_VERSION, config.muse.model, "coach", evidenceText]);
  const { value, cached } = await withFallback("coach", key, async () => {
    const raw = await callMuseJson<CoachFeedback>({
      messages: [
        { role: "developer", content: COACH_SYSTEM },
        { role: "user", content: `Evidence for this climb:\n${evidenceText}\n\nWrite the feedback JSON.` },
      ],
      schema: { name: "coach_feedback", schema: coachSchema },
      reasoningEffort: "medium",
    });
    return normalizeFeedback(raw, req.route?.holds.length ?? 0);
  });
  return { feedback: value, cached };
}

function normalizeFeedback(raw: Partial<CoachFeedback>, maxHold: number): CoachFeedback {
  const hold = (n: unknown) => {
    const v = Math.round(Number(n));
    return v >= 1 && v <= maxHold ? v : null;
  };
  const point = (p: Partial<CoachFeedback["strengths"][number]>) =>
    withSeconds({ title: p.title ?? "", detail: p.detail ?? "", t: p.t ?? null, holdNumber: hold(p.holdNumber) });

  return {
    headline: raw.headline?.trim() || "Here's what stood out in your climb.",
    strengths: (raw.strengths ?? []).filter((s) => s?.title).slice(0, 2).map(point),
    fixes: (raw.fixes ?? [])
      .filter((f) => f?.title)
      .slice(0, 2)
      .map((f) => ({ ...point(f), drill: f.drill ?? "" })),
    nextSession: (raw.nextSession ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 3),
    confidenceNote: raw.confidenceNote?.trim() ?? "",
  };
}

/* ==========================================================================
 * Crew → recap (who should teach whom)
 * ========================================================================== */

export async function crewRecap(req: CrewRequest): Promise<{ crew: CrewRecap; cached: boolean }> {
  if (!Array.isArray(req.crew) || req.crew.length < 2) {
    throw new ApiError(400, "A crew recap needs at least two analyzed climbers.");
  }
  const evidence = { route: describeRouteForCoach(req.route), crew: req.crew.map(evidenceFor) };
  const evidenceText = compactJson(evidence, 40000);
  const key = hashValue([PROMPT_VERSION, config.muse.model, "crew", evidenceText]);

  const { value, cached } = await withFallback("crew", key, async () => {
    const raw = await callMuseJson<CrewRecap>({
      messages: [
        { role: "developer", content: CREW_SYSTEM },
        { role: "user", content: `The crew's evidence:\n${evidenceText}\n\nWrite the crew session JSON.` },
      ],
      schema: { name: "crew_recap", schema: crewSchema },
      reasoningEffort: "medium",
    });
    return {
      recap: raw.recap?.trim() ?? "",
      highlights: (raw.highlights ?? []).filter((h) => h?.from && h?.to && h?.skill).slice(0, 4).map(withSeconds),
      pairings: (raw.pairings ?? []).filter((p) => Array.isArray(p?.climbers) && p.climbers.length).slice(0, 4),
      sessionPlan: (raw.sessionPlan ?? []).filter((s) => s?.step).slice(0, 5),
      challenge: raw.challenge?.trim() ?? "",
    } satisfies CrewRecap;
  });
  return { crew: value, cached };
}

/* ==========================================================================
 * Chat
 * ========================================================================== */

export async function chat(req: ChatRequest): Promise<string> {
  const history = (req.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!history.length || history[history.length - 1].role !== "user") {
    throw new ApiError(400, "Send a question for the coach.");
  }

  const evidence = {
    route: describeRouteForCoach(req.route),
    crew: (req.crew ?? []).map(evidenceFor),
  };
  const context = evidence.crew.length
    ? `Evidence:\n${compactJson(evidence, 40000)}`
    : "No climbs have been analyzed yet. You can still answer general bouldering questions, and invite them to upload a clip for specific feedback.";

  const reply = await callMuse({
    messages: [{ role: "developer", content: `${chatSystem(req.speaker)}\n\n${context}` }, ...history],
    reasoningEffort: "low",
    maxTokens: 4000,
  });
  return reply.trim();
}
