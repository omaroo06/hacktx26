import type { Hold, HoldColorId, WallPhoto } from "../types/wall";

/**
 * Contract for the computer-vision hold detector built by the CV team.
 * The web app depends only on this interface, so a real implementation
 * (local model, or a request to a detection API) can be dropped in later.
 */
export interface HoldDetector {
  detect(photo: WallPhoto): Promise<HoldDetectionResult>;
}

export interface HoldDetectionResult {
  holds: Hold[];
  /** Route colors found in the photo, most prominent first. */
  routeColors: HoldColorId[];
}

/**
 * No detector ships in Phase 1. Route selection is fully manual and the UI
 * reads this flag to label that clearly instead of showing invented results.
 */
export const holdDetector: HoldDetector | null = null;

export const isHoldDetectionAvailable = holdDetector !== null;
