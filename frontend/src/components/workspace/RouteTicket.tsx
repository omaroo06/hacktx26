import { Pencil, RotateCcw } from "lucide-react";
import type { RouteSelection, WallPhoto } from "../../types/wall";
import { getHoldColor } from "../../lib/holdColors";
import { HoldShape, Sparkle } from "../decor/Ornaments";
import { useBetaSession } from "../../state/BetaSession";

interface RouteTicketProps {
  photo: WallPhoto;
  route: RouteSelection;
  onEdit: () => void;
  onStartOver: () => void;
}

export function RouteTicket({ photo, route, onEdit, onStartOver }: RouteTicketProps) {
  const { routeHolds, detection } = useBetaSession();
  if (!route.color) return null;
  const color = getHoldColor(route.color);
  const name = route.name.trim() || `${color.label} route`;
  const grade = route.grade.trim() || "Ungraded";

  const draft = {
    wall: { image: photo.name, widthPx: photo.widthPx, heightPx: photo.heightPx, dimensionsM: null },
    route: { color: route.color, name: route.name.trim() || null, grade: route.grade.trim() || null, source: route.source },
    holds: routeHolds.map((h) => ({
      number: h.number,
      kind: h.kind,
      // Normalized to the photo (0–1, origin top-left) and in photo pixels.
      norm: { x: h.x, y: h.y },
      pixel: { x: Math.round(h.x * photo.widthPx), y: Math.round(h.y * photo.heightPx) },
    })),
    detectedBy: detection.model,
  };

  return (
    <div className="flex flex-col gap-6 anim-pop-in">
      <div className="ticket" style={{ background: color.fill, color: color.onFill }}>
        <div className="ticket-stub" aria-hidden="true">
          <HoldShape fill={color.fill} shade={color.shade} className="h-14 w-14" />
        </div>
        <div className="min-w-0 flex-1 p-5">
          <p className="pixel text-[0.68rem] opacity-80">Route ticket · {color.label} holds</p>
          <h3 className="mt-1.5 break-words text-[clamp(1.6rem,2.6vw,2.2rem)]">{name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="tag">{grade}</span>
            <span className="tag">Your pick</span>
          </div>
        </div>
        <Sparkle size={22} className="absolute right-4 top-4 anim-twinkle" color="var(--color-paper)" />
      </div>

      <dl className="ticket-facts">
        <div>
          <dt>Wall photo</dt>
          <dd className="truncate" title={photo.name}>{photo.name}</dd>
        </div>
        <div>
          <dt>Photo size</dt>
          <dd>
            {photo.widthPx} × {photo.heightPx} px
          </dd>
        </div>
        <div>
          <dt>Hold color</dt>
          <dd>{color.label}</dd>
        </div>
        <div>
          <dt>Grade</dt>
          <dd>{grade}</dd>
        </div>
        <div className="col-span-full">
          <dt>Holds mapped</dt>
          <dd>
            {routeHolds.length
              ? `${routeHolds.length} numbered, start to finish`
              : detection.status === "loading"
                ? "Gemini is still reading the photo…"
                : "None yet"}
          </dd>
        </div>
      </dl>

      <details className="data-peek">
        <summary>Peek at the route data</summary>
        <p className="mt-2 text-[0.88rem] text-ink/70">
          The route record <span className="brand">beta</span> carries into your VR wall. Hold positions come from
          the photo; wall dimensions in meters fill in once the wall is calibrated.
        </p>
        <pre>{JSON.stringify(draft, null, 2)}</pre>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t-[3px] border-dashed border-ink/20 pt-6">
        <button type="button" className="link-btn" onClick={onStartOver}>
          <RotateCcw size={17} strokeWidth={2.8} />
          Start a new wall
        </button>
        <button type="button" className="btn btn-paper" onClick={onEdit}>
          <Pencil size={17} strokeWidth={2.8} />
          Edit route
        </button>
      </div>
    </div>
  );
}
