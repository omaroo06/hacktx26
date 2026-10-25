/**
 * Types shared by the web app and the API server (server/).
 *
 * Division of labor:
 *   Gemini      = beta's eyes. Reads the wall photo (holds) and watches climbing clips.
 *   Muse Spark  = beta's coach. Turns what Gemini saw into feedback, crew recaps, and chat.
 *
 * Image positions are normalized to the photo: x and y in [0, 1], origin top-left.
 */

import type { HoldColorId } from "./wall";

export type Experience = "new" | "intermediate" | "advanced";

/* --------------------------------------------------------------------------
 * Wall photo → holds (Gemini)
 * ------------------------------------------------------------------------ */

export type HoldKind = "hold" | "start" | "finish" | "volume";

export interface DetectedHold {
  color: HoldColorId;
  kind: HoldKind;
  /** Center of the hold, normalized to the photo. */
  x: number;
  y: number;
  /** Size of the hold's box, normalized to the photo. */
  w: number;
  h: number;
}

export interface DetectHoldsResponse {
  holds: DetectedHold[];
  /** Hold colors that form routes in the photo, most prominent first. */
  routeColors: HoldColorId[];
  model: string;
  cached: boolean;
}

/** One hold of the chosen route, numbered bottom to top. */
export interface RouteHoldRef {
  number: number;
  x: number;
  y: number;
  kind: HoldKind;
}

export interface RouteContext {
  color: HoldColorId | null;
  name: string;
  grade: string;
  holds: RouteHoldRef[];
}

/* --------------------------------------------------------------------------
 * Climbing clip → what happened (Gemini)
 * ------------------------------------------------------------------------ */

export type Limb = "left hand" | "right hand" | "left foot" | "right foot" | "body";

export type ObservationCategory =
  | "footwork"
  | "hips"
  | "arms"
  | "balance"
  | "pacing"
  | "route-reading"
  | "dynamic"
  | "rest";

export type ObservationTone = "strength" | "issue" | "note";

export interface ClimbMove {
  /** "MM:SS" as written by the model. */
  t: string;
  /** Parsed from `t` by the server. */
  seconds: number;
  limb: Limb;
  action: string;
  holdNumber: number | null;
}

export interface ClimbObservation {
  t: string;
  seconds: number;
  category: ObservationCategory;
  tone: ObservationTone;
  detail: string;
  holdNumber: number | null;
  confidence: "high" | "medium" | "low";
}

export interface VisionReport {
  summary: string;
  outcome: "sent" | "fell" | "stepped off" | "unclear";
  durationSeconds: number;
  /** True when the clip shows the same wall as the mapped photo; null when no photo was given. */
  sameWallAsPhoto: boolean | null;
  visibility: { quality: "good" | "partial" | "poor"; notes: string };
  moves: ClimbMove[];
  observations: ClimbObservation[];
}

export interface VisionResponse {
  report: VisionReport;
  model: string;
  cached: boolean;
}

/* --------------------------------------------------------------------------
 * Coaching (Muse Spark)
 * ------------------------------------------------------------------------ */

export interface ClimberProfileInput {
  name: string;
  heightCm: number | null;
  wingspanCm: number | null;
  experience: Experience;
}

export interface CoachPoint {
  title: string;
  detail: string;
  t: string | null;
  seconds: number | null;
  holdNumber: number | null;
}

export interface CoachFix extends CoachPoint {
  drill: string;
}

export interface CoachFeedback {
  headline: string;
  strengths: CoachPoint[];
  fixes: CoachFix[];
  nextSession: string[];
  confidenceNote: string;
}

export interface CoachRequest {
  climber: ClimberProfileInput;
  route: RouteContext | null;
  report: VisionReport;
  /** Optional MediaPipe pose report (observations.json from the AI Mentor). */
  poseReport?: unknown;
}

export interface CoachResponse {
  feedback: CoachFeedback;
  model: string;
  cached: boolean;
}

/** Everything the coach knows about one climber. */
export interface ClimberDossier {
  climber: ClimberProfileInput;
  report: VisionReport;
  feedback: CoachFeedback | null;
}

export interface CrewHighlight {
  from: string;
  to: string;
  skill: string;
  t: string | null;
  seconds: number | null;
}

export interface CrewRecap {
  recap: string;
  highlights: CrewHighlight[];
  pairings: { climbers: string[]; why: string }[];
  sessionPlan: { step: string; who: string }[];
  challenge: string;
}

export interface CrewRequest {
  route: RouteContext | null;
  crew: ClimberDossier[];
}

export interface CrewResponse {
  crew: CrewRecap;
  model: string;
  cached: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  /** Name of the climber who is chatting. */
  speaker: string;
  messages: ChatMessage[];
  route: RouteContext | null;
  crew: ClimberDossier[];
}

export interface ChatResponse {
  reply: string;
  model: string;
}

/* --------------------------------------------------------------------------
 * Server status
 * ------------------------------------------------------------------------ */

export interface ApiHealth {
  gemini: { ready: boolean; model: string };
  muse: { ready: boolean; model: string };
  pose: { ready: boolean };
}
