import { useCallback, useEffect, useRef, useState } from "react";
import type { ClimberDossier, ClimberProfileInput, CoachFeedback, Experience, VisionReport } from "../../types/coach";
import { api } from "../../services/api";
import { useBetaSession } from "../../state/BetaSession";

export type ClimbStage = "idle" | "watching" | "coaching" | "done" | "error";

export interface Clip {
  file: File;
  url: string;
}

export interface Climber {
  id: string;
  name: string;
  heightFt: string;
  heightIn: string;
  spanFt: string;
  spanIn: string;
  experience: Experience;
  clip: Clip | null;
  poseReport: unknown | null;
  poseFileName: string | null;
  stage: ClimbStage;
  error: string | null;
  report: VisionReport | null;
  feedback: CoachFeedback | null;
  visionCached: boolean;
  coachCached: boolean;
  /** Which Gemini model watched the clip (a backup answers when the main one is busy). */
  visionModel: string | null;
}

export const MAX_CREW = 4;
export const MAX_CLIP_BYTES = 300 * 1024 * 1024;
const CLIP_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
const CLIP_EXTS = [".mp4", ".mov", ".m4v", ".webm"];
export const CLIP_ACCEPT = [...CLIP_TYPES, ...CLIP_EXTS].join(",");

let nextId = 1;
const newClimber = (): Climber => ({
  id: `c${nextId++}`,
  name: "",
  heightFt: "",
  heightIn: "",
  spanFt: "",
  spanIn: "",
  experience: "new",
  clip: null,
  poseReport: null,
  poseFileName: null,
  stage: "idle",
  error: null,
  report: null,
  feedback: null,
  visionCached: false,
  coachCached: false,
  visionModel: null,
});

export function displayName(c: Climber, index: number): string {
  return c.name.trim() || `Climber ${index + 1}`;
}

function toCm(ft: string, inches: string): number | null {
  const f = Number(ft) || 0;
  const i = Number(inches) || 0;
  const total = f * 12 + i;
  return total >= 36 && total <= 96 ? Math.round(total * 2.54) : null;
}

export function profileOf(c: Climber, index: number): ClimberProfileInput {
  return {
    name: displayName(c, index),
    heightCm: toCm(c.heightFt, c.heightIn),
    wingspanCm: toCm(c.spanFt, c.spanIn),
    experience: c.experience,
  };
}

export function validateClip(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!CLIP_TYPES.includes(file.type) && !CLIP_EXTS.includes(ext)) {
    return `“${file.name}” isn't a video beta can read. Use MP4, MOV, or WebM.`;
  }
  if (file.size > MAX_CLIP_BYTES) return `“${file.name}” is over 300 MB. Trim the clip to just the climb.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

export function useCrew() {
  const { wall, routeContext, health } = useBetaSession();
  const [crew, setCrew] = useState<Climber[]>(() => [newClimber()]);
  const crewRef = useRef(crew);
  crewRef.current = crew;

  // Free video memory when the section unmounts.
  useEffect(
    () => () => {
      crewRef.current.forEach((c) => c.clip && URL.revokeObjectURL(c.clip.url));
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<Climber> | ((c: Climber) => Partial<Climber>)) => {
    setCrew((list) => list.map((c) => (c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)));
  }, []);

  const add = useCallback(() => setCrew((list) => (list.length >= MAX_CREW ? list : [...list, newClimber()])), []);

  const removeClimber = useCallback((id: string) => {
    setCrew((list) => {
      const gone = list.find((c) => c.id === id);
      if (gone?.clip) URL.revokeObjectURL(gone.clip.url);
      const next = list.filter((c) => c.id !== id);
      return next.length ? next : [newClimber()];
    });
  }, []);

  const setClip = useCallback(
    (id: string, file: File | null): string | null => {
      if (file) {
        const problem = validateClip(file);
        if (problem) return problem;
      }
      update(id, (c) => {
        if (c.clip) URL.revokeObjectURL(c.clip.url);
        return {
          clip: file ? { file, url: URL.createObjectURL(file) } : null,
          stage: "idle",
          error: null,
          report: null,
          feedback: null,
        };
      });
      return null;
    },
    [update],
  );

  /** Runs Gemini (watch) then Muse Spark (coach). Resumes at coaching if the video was already watched. */
  const analyze = useCallback(
    async (id: string) => {
      const index = crewRef.current.findIndex((c) => c.id === id);
      const climber = crewRef.current[index];
      if (!climber?.clip) return;

      let report = climber.report;
      let poseReport = climber.poseReport;

      if (!report) {
        update(id, { stage: "watching", error: null });
        try {
          const wantsPose = health?.pose.ready && !poseReport;
          const [vision, pose] = await Promise.all([
            api.vision({ video: climber.clip.file, wallPhoto: wall.photo?.file ?? null, route: routeContext }),
            wantsPose ? api.pose(climber.clip.file).catch(() => null) : Promise.resolve(null),
          ]);
          report = vision.report;
          if (pose) poseReport = pose;
          update(id, {
            report,
            visionCached: vision.cached,
            visionModel: vision.model,
            poseReport,
            poseFileName: pose ? "AI Mentor (live)" : climber.poseFileName,
          });
        } catch (err) {
          update(id, { stage: "error", error: (err as Error).message });
          return;
        }
      }

      update(id, { stage: "coaching", error: null });
      try {
        const latest = crewRef.current.find((c) => c.id === id) ?? climber;
        const { feedback, cached } = await api.coach({
          climber: profileOf(latest, index),
          route: routeContext,
          report,
          poseReport: poseReport ?? undefined,
        });
        update(id, { stage: "done", feedback, coachCached: cached });
      } catch (err) {
        update(id, { stage: "error", error: (err as Error).message });
      }
    },
    [health, routeContext, update, wall.photo],
  );

  const analyzeAll = useCallback(async () => {
    const ready = crewRef.current.filter((c) => c.clip && c.stage !== "done" && c.stage !== "watching" && c.stage !== "coaching");
    // Two at a time keeps uploads quick without tripping rate limits.
    for (let i = 0; i < ready.length; i += 2) {
      await Promise.all(ready.slice(i, i + 2).map((c) => analyze(c.id)));
    }
  }, [analyze]);

  const dossiers: (ClimberDossier & { id: string })[] = crew.flatMap((c, i) =>
    c.report ? [{ id: c.id, climber: profileOf(c, i), report: c.report, feedback: c.feedback }] : [],
  );

  return { crew, update, add, removeClimber, setClip, analyze, analyzeAll, dossiers };
}
