import type { Hold, HoldColorId, WallPhoto } from "../types/wall";
import type { RouteHoldRef } from "../types/coach";
import { api } from "./api";

/**
 * Contract for the hold detector. The web app depends only on this interface,
 * so the Gemini-backed detector below can be swapped for a local model later.
 */
export interface HoldDetector {
  detect(photo: WallPhoto): Promise<HoldDetectionResult>;
}

export interface HoldDetectionResult {
  holds: Hold[];
  /** Route colors found in the photo, most prominent first. */
  routeColors: HoldColorId[];
  /** Which model found the holds, for display. */
  model: string;
  /** True when the server answered from its saved results. */
  cached: boolean;
}

/** Gemini reads the photo on the beta server and returns every hold it can see. */
export const holdDetector: HoldDetector = {
  async detect(photo) {
    const result = await api.detectHolds(photo.file);
    const holds: Hold[] = result.holds.map((h, i) => ({
      id: `h${i + 1}`,
      color: h.color,
      kind: h.kind,
      pixel: { x: Math.round(h.x * photo.widthPx), y: Math.round(h.y * photo.heightPx) },
      norm: { x: h.x, y: h.y, w: h.w, h: h.h },
      source: "detected",
    }));
    return { holds, routeColors: result.routeColors, model: result.model, cached: result.cached };
  },
};

/**
 * The chosen route's holds, numbered the way climbers read a route:
 * start holds first, then bottom to top, finish last.
 */
export function numberRouteHolds(holds: Hold[], color: HoldColorId | null): RouteHoldRef[] {
  if (!color) return [];
  const rank = (h: Hold) => (h.kind === "start" ? 0 : h.kind === "finish" ? 2 : 1);
  return holds
    .filter((h) => h.color === color && h.norm && h.kind !== "volume")
    .sort((a, b) => rank(a) - rank(b) || b.norm!.y - a.norm!.y || a.norm!.x - b.norm!.x)
    .map((h, i) => ({ number: i + 1, x: h.norm!.x, y: h.norm!.y, kind: h.kind ?? "hold" }));
}
