/**
 * Shared domain types for Beta.
 *
 * Wall coordinate convention (shared with the Unity / Meta Quest team):
 *   origin  bottom-left corner of the climbing wall
 *   x       horizontal, left → right across the wall
 *   y       vertical, up the wall
 *   z       distance away from the wall surface (towards the climber)
 *   units   meters
 *
 * Image pixel coordinates use the browser convention instead:
 *   origin top-left of the photograph, x → right, y → down, units px.
 */

export type HoldColorId =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "purple"
  | "white"
  | "black";

/** A wall photograph the user has uploaded in this session. */
export interface WallPhoto {
  file: File;
  /** Object URL for previewing; revoked when the photo is removed or replaced. */
  url: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  widthPx: number;
  heightPx: number;
}

/** Where a piece of route data came from. Phase 1 only produces "manual". */
export type DataSource = "manual" | "detected";

/** The route the climber chose to climb on this wall. */
export interface RouteSelection {
  color: HoldColorId | null;
  name: string;
  grade: string;
  source: DataSource;
}

/* --------------------------------------------------------------------------
 * Future-phase types. Declared now so later features share one vocabulary;
 * nothing in Phase 1 produces these values yet.
 * ------------------------------------------------------------------------ */

export interface PixelPoint {
  x: number;
  y: number;
}

/** A point on the wall in meters, using the convention documented above. */
export interface WallPoint {
  x: number;
  y: number;
  z: number;
}

export interface Hold {
  id: string;
  color: HoldColorId;
  pixel: PixelPoint;
  /** Filled in once the wall has been calibrated. */
  wall?: WallPoint;
  source: DataSource;
  /** Detector confidence in [0, 1]; absent for manually placed holds. */
  confidence?: number;
  /** Start and finish holds are marked on the wall; volumes are the big geometric shapes. */
  kind?: "hold" | "start" | "finish" | "volume";
  /** The hold's box normalized to the photo (0–1, origin top-left), for overlays. */
  norm?: { x: number; y: number; w: number; h: number };
}

export interface WallCalibration {
  widthM: number;
  heightM: number;
  /** Wall corners in image pixels, for perspective correction. */
  corners?: {
    topLeft: PixelPoint;
    topRight: PixelPoint;
    bottomRight: PixelPoint;
    bottomLeft: PixelPoint;
  };
}

export interface ClimberProfile {
  heightM: number;
  wingspanM: number;
  experience: "new" | "intermediate" | "advanced";
}
