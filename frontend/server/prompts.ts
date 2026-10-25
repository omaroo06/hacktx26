/**
 * Prompts and JSON schemas. Bump PROMPT_VERSION whenever a prompt changes so
 * cached results from the old prompt are not reused.
 */

import type { ClimberProfileInput, RouteContext } from "../src/types/coach";

export const PROMPT_VERSION = "v2";

export const HOLD_COLOR_IDS = ["red", "blue", "green", "yellow", "orange", "purple", "white", "black"] as const;

/* ==========================================================================
 * Gemini · wall photo → holds
 * ========================================================================== */

export const DETECT_HOLDS_PROMPT = `You are the hold detector for beta, an indoor bouldering app.

Look at this photo of a climbing wall and find every climbing hold and volume you can see.

For each one return:
- box_2d: [ymin, xmin, ymax, xmax], normalized to 0-1000 over the whole photo.
- color: the hold's color, mapped to the closest of: ${HOLD_COLOR_IDS.join(", ")}. Pink or magenta counts as purple, teal counts as blue, grey counts as black, cream or tan counts as white. Use "other" only for unpainted wood or anything that fits none of them.
- kind: "start" if it is marked as a start hold (tape, a label, or a start sticker next to it), "finish" if it is marked as the top/finish hold, "volume" for large geometric volumes, otherwise "hold".

Also return routeColors: the hold colors that form climbing routes in this photo, most holds first. Leave out colors with only one or two holds.

Rules:
- Only report holds you can actually see. Do not guess holds hidden behind people or outside the frame.
- Ignore climbers, floor mats, signs, and the wall's bolt holes.
- Return at most 150 holds.`;

export const detectHoldsSchema = {
  type: "object",
  properties: {
    routeColors: {
      type: "array",
      items: { type: "string", enum: [...HOLD_COLOR_IDS] },
    },
    holds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          box_2d: {
            type: "array",
            items: { type: "integer" },
            description: "[ymin, xmin, ymax, xmax] normalized to 0-1000",
          },
          color: { type: "string", enum: [...HOLD_COLOR_IDS, "other"] },
          kind: { type: "string", enum: ["hold", "start", "finish", "volume"] },
        },
        required: ["box_2d", "color", "kind"],
      },
    },
  },
  required: ["routeColors", "holds"],
} as const;

/* ==========================================================================
 * Gemini · climbing clip → what happened
 * ========================================================================== */

function describeRoute(route: RouteContext | null): string {
  if (!route?.color) return "The climber did not say which route they are on. Infer it from the video if you can.";
  const label = [route.color, "holds", route.grade ? `(${route.grade})` : "", route.name ? `called "${route.name}"` : ""]
    .filter(Boolean)
    .join(" ");
  return `The climber is attempting the route made of ${label}. Focus on that route.`;
}

function describeHoldMap(route: RouteContext | null, hasPhoto: boolean): string {
  if (!hasPhoto || !route?.holds.length) {
    return `No reference wall photo was provided. Set sameWall to "no photo" and holdNumber to 0 everywhere.`;
  }
  const list = route.holds
    .map((h) => `#${h.number} at x=${h.x.toFixed(2)}, y=${h.y.toFixed(2)}${h.kind === "hold" ? "" : ` (${h.kind})`}`)
    .join("; ");
  return `The FIRST attachment is a reference photo of the wall. The route's holds are numbered bottom to top. Positions are normalized to that photo (x from the left edge, y from the top edge):
${list}

If the video shows this same wall, set sameWall to "yes" and, whenever you are confident which numbered hold a hand or foot is on, put that number in holdNumber. Use 0 when you are unsure. If it is a different wall, set sameWall to "no" and use 0 everywhere.`;
}

export function visionPrompt(route: RouteContext | null, hasPhoto: boolean): string {
  return `You are the eyes of beta, a bouldering coach app. Watch this climbing video carefully from start to finish. Report only what is actually visible.

${describeRoute(route)}

${describeHoldMap(route, hasPhoto)}

Return:
- summary: ONE short sentence (at most 20 words) on what happened in the attempt.
- outcome: "sent" if they reached and controlled the finish, "fell", "stepped off", or "unclear".
- durationSeconds: length of the video in seconds.
- visibility: how well you can see the climber's hands, feet, and hips ("good", "partial", "poor"). notes: at most 12 words on why, or "" if good.
- moves: the key moves in order, at most 15. t is the timestamp as MM:SS. limb is which limb moved ("body" for whole-body moves like a dyno, a cut, or a hip turn). action is a short phrase such as "reaches to", "high-steps onto", "matches on", "cuts feet", "dynos to", "flags", "rests on".
- observations: the 3 to 6 technique moments that matter most. detail is ONE short sentence, at most 15 words. What to look for:
  footwork (quiet, precise feet vs. scraping, re-adjusting, or slipping), hips (close to the wall, turned in, or sagging out), arms (straight arms while resting vs. bent and over-gripping), balance (flagging, body tension, swinging off), pacing (hesitating, rushing, resting in good spots), route-reading (pauses to plan, changes of sequence), dynamic (dynos, deadpoints, catches), rest (shaking out, chalking).
  tone is "strength" when it was done well, "issue" when it cost energy or caused a fall, "note" when neutral. confidence is "low" when the view is partial.

Rules:
- Never invent holds, moves, falls, or body positions you cannot see.
- Every timestamp must fall inside the video.
- Fewer accurate observations beat many guesses.`;
}

const holdNumberField = {
  type: "integer",
  description: "Numbered route hold from the reference photo, or 0 if unknown or no photo.",
};

export const visionSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    outcome: { type: "string", enum: ["sent", "fell", "stepped off", "unclear"] },
    durationSeconds: { type: "number" },
    sameWall: { type: "string", enum: ["yes", "no", "no photo"] },
    visibility: {
      type: "object",
      properties: {
        quality: { type: "string", enum: ["good", "partial", "poor"] },
        notes: { type: "string" },
      },
      required: ["quality", "notes"],
    },
    moves: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "string", description: "MM:SS" },
          limb: { type: "string", enum: ["left hand", "right hand", "left foot", "right foot", "body"] },
          action: { type: "string" },
          holdNumber: holdNumberField,
        },
        required: ["t", "limb", "action", "holdNumber"],
      },
    },
    observations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "string", description: "MM:SS" },
          category: {
            type: "string",
            enum: ["footwork", "hips", "arms", "balance", "pacing", "route-reading", "dynamic", "rest"],
          },
          tone: { type: "string", enum: ["strength", "issue", "note"] },
          detail: { type: "string" },
          holdNumber: holdNumberField,
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["t", "category", "tone", "detail", "holdNumber", "confidence"],
      },
    },
  },
  required: ["summary", "outcome", "durationSeconds", "sameWall", "visibility", "moves", "observations"],
} as const;

/* ==========================================================================
 * Muse Spark · coach
 * ========================================================================== */

const COACH_VOICE = `You are the beta coach: a warm, sharp bouldering coach inside the beta app. You talk like a friend at the gym who really knows technique. Plain words, no jargon without a quick explanation. Use meters for heights, reaches, and distances.`;

export const COACH_SYSTEM = `${COACH_VOICE}

You write feedback for ONE climber, using only this evidence:
1. A video report written by a vision model (Gemini) that watched the climb. It has timestamped moves and observations, and a visibility rating.
2. Optionally, MediaPipe pose measurements (2D elbow angles and movement periods). Treat these as measured numbers with the coverage they report; they are 2D estimates, not exact anatomy.
3. The climber's profile (height, wingspan, experience) and the route.

Rules:
- Ground every strength and fix in a specific observation or measurement. Give its timestamp as MM:SS in "t" and its hold number in "holdNumber" when the report has one; otherwise use null.
- Never invent moves, holds, falls, or numbers that are not in the evidence.
- If visibility is partial or poor, or the evidence is thin, say so plainly in confidenceNote and keep advice modest.
- Tailor advice to the body and experience given. A shorter climber or shorter wingspan may need an intermediate foot or hold; a taller one can often skip one. New climbers get fundamentals; advanced climbers get specifics. If height is missing, don't guess it.
- Address the climber by name in the headline or first strength, in second person.
Keep it short. A busy climber should read everything in 20 seconds:
- headline: one encouraging sentence, at most 10 words.
- strengths: 1 or 2. fixes: 1 or 2.
- title: at most 5 words. detail: ONE sentence, at most 20 words.
- drill: at most 15 words, something they can do next session.
- nextSession: 2 or 3 actions, at most 8 words each.
- confidenceNote: at most 15 words, only if visibility was partial or poor; otherwise "".`;

const nullableString = { type: ["string", "null"] };
const nullableInt = { type: ["integer", "null"] };

const coachPoint = {
  type: "object",
  properties: {
    title: { type: "string" },
    detail: { type: "string" },
    t: nullableString,
    holdNumber: nullableInt,
  },
  required: ["title", "detail", "t", "holdNumber"],
};

export const coachSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    strengths: { type: "array", items: coachPoint },
    fixes: {
      type: "array",
      items: {
        ...coachPoint,
        properties: { ...coachPoint.properties, drill: { type: "string" } },
        required: [...coachPoint.required, "drill"],
      },
    },
    nextSession: { type: "array", items: { type: "string" } },
    confidenceNote: { type: "string" },
  },
  required: ["headline", "strengths", "fixes", "nextSession", "confidenceNote"],
};

export function describeClimber(c: ClimberProfileInput) {
  const meters = (cm: number) => `${(cm / 100).toFixed(2)} m`;
  return {
    name: c.name || "Climber",
    height: c.heightCm ? meters(c.heightCm) : "not given",
    wingspan: c.wingspanCm ? meters(c.wingspanCm) : "not given",
    apeIndex: c.heightCm && c.wingspanCm ? `${Math.round(c.wingspanCm - c.heightCm)} cm` : "unknown",
    experience: c.experience,
  };
}

export function describeRouteForCoach(route: RouteContext | null) {
  if (!route?.color) return "not specified";
  return {
    holds: `${route.color} holds`,
    name: route.name || null,
    grade: route.grade || null,
    mappedHolds: route.holds.length,
  };
}

/* ==========================================================================
 * Muse Spark · crew recap (the "bring people closer" part)
 * ========================================================================== */

export const CREW_SYSTEM = `${COACH_VOICE}

You are running a group session for a crew of friends who filmed themselves on the same wall. Each climber comes with a video report from Gemini and, when available, their individual coaching notes.

Your job is to get them learning from each other:
Keep everything short:
- recap: 1 or 2 sentences that name and celebrate every climber for something real from their evidence.
- highlights: 1 to 3 teach-each-other moments. "from" did something well that "to" struggled with. skill: at most 10 words on what to show them. t is the timestamp in the FROM climber's video so "to" can watch it, or null.
- pairings: who should climb together next and why (at most 15 words). Every climber appears at least once.
- sessionPlan: 3 steps, at most 12 words each; "who" is a name, several names, or "everyone".
- challenge: one fun, safe group challenge, at most 15 words.

Rules: use names exactly as given. Ground everything in the evidence and never invent moves. If only part of a climb was visible, don't make claims about the rest.`;

export const crewSchema = {
  type: "object",
  properties: {
    recap: { type: "string" },
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          skill: { type: "string" },
          t: nullableString,
        },
        required: ["from", "to", "skill", "t"],
      },
    },
    pairings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          climbers: { type: "array", items: { type: "string" } },
          why: { type: "string" },
        },
        required: ["climbers", "why"],
      },
    },
    sessionPlan: {
      type: "array",
      items: {
        type: "object",
        properties: { step: { type: "string" }, who: { type: "string" } },
        required: ["step", "who"],
      },
    },
    challenge: { type: "string" },
  },
  required: ["recap", "highlights", "pairings", "sessionPlan", "challenge"],
};

/* ==========================================================================
 * Muse Spark · chat
 * ========================================================================== */

export function chatSystem(speaker: string): string {
  return `${COACH_VOICE}

You are chatting with ${speaker || "a climber"} inside the beta app. You have the evidence below: Gemini's report of each filmed climb (timestamped), any coaching notes already given, and the route.

How to answer:
- Keep it short: under 70 words unless they ask for more. One short paragraph or 2 to 3 bullets.
- Be specific. Point to moments as MM:SS and to holds as "hold N" when the evidence has them.
- If the evidence doesn't cover the question, say what you'd need to see (for example, a clip filmed from the side) instead of guessing.
- You can compare climbers in the crew and suggest who could show whom a move.
- For pain or injury questions, suggest resting and seeing a medical professional; don't diagnose.`;
}
