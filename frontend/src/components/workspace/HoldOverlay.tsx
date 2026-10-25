import type { CSSProperties } from "react";
import type { Hold, HoldColorId } from "../../types/wall";
import type { RouteHoldRef } from "../../types/coach";
import { getHoldColor } from "../../lib/holdColors";

interface HoldOverlayProps {
  holds: Hold[];
  routeColor: HoldColorId | null;
  routeHolds: RouteHoldRef[];
  highlight?: number | null;
  onHover?: (n: number | null) => void;
  /** Smaller numbers for thumbnails. */
  compact?: boolean;
}

/** Places a box exactly over a hold, in percentages of the photo. */
function boxStyle(x: number, y: number, w: number, h: number, ring: string): CSSProperties {
  return {
    left: `${(x - w / 2) * 100}%`,
    top: `${(y - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    "--ring": ring,
  } as CSSProperties;
}

/**
 * Draws what Gemini found on top of the wall photo. Before a route is chosen it
 * shows every hold in its color; after, it numbers the chosen route start → finish.
 */
export function HoldOverlay({ holds, routeColor, routeHolds, highlight = null, onHover, compact = false }: HoldOverlayProps) {
  if (!holds.length) return null;

  if (!routeColor) {
    return (
      <div className="hold-layer" aria-hidden="true">
        {holds.map((h) =>
          h.norm ? (
            <span key={h.id} className="hold-box" style={boxStyle(h.norm.x, h.norm.y, h.norm.w, h.norm.h, getHoldColor(h.color).fill)}>
              <span className="hold-ring is-found" />
            </span>
          ) : null,
        )}
      </div>
    );
  }

  const fill = getHoldColor(routeColor).fill;
  const sizeOf = new Map(
    holds.filter((h) => h.color === routeColor && h.norm).map((h) => [`${h.norm!.x},${h.norm!.y}`, h.norm!]),
  );

  return (
    <div className={`hold-layer ${compact ? "is-compact" : ""}`}>
      {routeHolds.map((h) => {
        const box = sizeOf.get(`${h.x},${h.y}`);
        const label = h.kind === "start" ? `Hold ${h.number}, start` : h.kind === "finish" ? `Hold ${h.number}, finish` : `Hold ${h.number}`;
        return (
          <span key={h.number} className="hold-box" style={boxStyle(h.x, h.y, box?.w ?? 0.04, box?.h ?? 0.03, fill)}>
            <span
              className={`hold-ring is-route kind-${h.kind} ${highlight === h.number ? "is-highlight" : ""}`}
              onMouseEnter={onHover ? () => onHover(h.number) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
              title={label}
            >
              <span className="hold-num" aria-label={label}>
                {h.number}
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
