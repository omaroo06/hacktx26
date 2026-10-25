import type { HoldColorId } from "../types/wall";

export interface HoldColor {
  id: HoldColorId;
  label: string;
  /** Swatch fill used in the UI. */
  fill: string;
  /** Darker tone for the swatch's shaded side. */
  shade: string;
  /** Text color that stays readable on top of `fill`. */
  onFill: string;
}

export const HOLD_COLORS: readonly HoldColor[] = [
  { id: "red", label: "Red", fill: "#E5533F", shade: "#B23A2A", onFill: "#FFF3D6" },
  { id: "blue", label: "Blue", fill: "#3F86D9", shade: "#2A5FA3", onFill: "#FFF3D6" },
  { id: "green", label: "Green", fill: "#43A766", shade: "#2E7A49", onFill: "#FFF3D6" },
  { id: "yellow", label: "Yellow", fill: "#F5CB3A", shade: "#C99D16", onFill: "#202820" },
  { id: "orange", label: "Orange", fill: "#F28A2E", shade: "#C2641A", onFill: "#202820" },
  { id: "purple", label: "Purple", fill: "#8E62D1", shade: "#6641A3", onFill: "#FFF3D6" },
  { id: "white", label: "White", fill: "#FBF7EE", shade: "#D8D1C1", onFill: "#202820" },
  { id: "black", label: "Black", fill: "#2B2F2B", shade: "#141714", onFill: "#FFF3D6" },
];

export function getHoldColor(id: HoldColorId): HoldColor {
  const color = HOLD_COLORS.find((c) => c.id === id);
  if (!color) throw new Error(`Unknown hold color: ${id}`);
  return color;
}

/** Common bouldering grades offered as quick picks; any text is still accepted. */
export const QUICK_GRADES = ["VB", "V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8"] as const;
