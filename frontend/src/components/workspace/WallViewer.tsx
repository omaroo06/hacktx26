import { RefreshCw, RotateCw, ScanSearch, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { RouteSelection, WallPhoto } from "../../types/wall";
import { getHoldColor } from "../../lib/holdColors";
import { formatBytes } from "../../lib/imageValidation";
import { useBetaSession } from "../../state/BetaSession";
import { HoldOverlay } from "./HoldOverlay";

interface WallViewerProps {
  photo: WallPhoto;
  route: RouteSelection;
  isDragging: boolean;
  isLoading: boolean;
  onReplace: () => void;
  onRemove: () => void;
}

export function WallViewer({ photo, route, isDragging, isLoading, onReplace, onRemove }: WallViewerProps) {
  const { detection, routeHolds, highlightHold, setHighlightHold, redetect } = useBetaSession();
  const color = route.color ? getHoldColor(route.color) : null;
  const orientation = photo.heightPx > photo.widthPx ? "Portrait" : photo.heightPx === photo.widthPx ? "Square" : "Landscape";
  const isScanning = detection.status === "loading";

  return (
    <figure
      className="viewer"
      style={{ "--route-fill": color?.fill ?? "transparent" } as CSSProperties}
      aria-label="Your climbing wall photo"
    >
      <div className="viewer-toolbar">
        <div className="min-w-0">
          <p className="truncate font-extrabold leading-tight" title={photo.name}>
            {photo.name}
          </p>
          <p className="pixel mt-0.5 text-[0.66rem] text-ink/65">
            {photo.widthPx} × {photo.heightPx} px · {orientation} · {formatBytes(photo.sizeBytes)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn btn-paper btn-sm" onClick={onReplace} disabled={isLoading}>
            <RefreshCw size={16} strokeWidth={2.8} />
            <span>Replace</span>
          </button>
          <button type="button" className="btn btn-coral btn-sm" onClick={onRemove} disabled={isLoading}>
            <Trash2 size={16} strokeWidth={2.8} />
            <span>Remove</span>
          </button>
        </div>
      </div>

      <div className="viewer-stage bg-grid-dark">
        <div className={`viewer-photo ${color ? "has-route" : ""} ${isScanning ? "is-scanning" : ""}`} key={photo.url}>
          <img
            src={photo.url}
            alt={`Uploaded climbing wall photo, ${photo.name}`}
            width={photo.widthPx}
            height={photo.heightPx}
            draggable={false}
          />
          <HoldOverlay
            holds={detection.holds}
            routeColor={route.color}
            routeHolds={routeHolds}
            highlight={highlightHold}
            onHover={setHighlightHold}
          />
          {isScanning && <span className="scan-bar" aria-hidden="true" />}
          <span className="viewfinder tl" aria-hidden="true" />
          <span className="viewfinder tr" aria-hidden="true" />
          <span className="viewfinder bl" aria-hidden="true" />
          <span className="viewfinder br" aria-hidden="true" />
        </div>

        {(isDragging || isLoading) && (
          <div className="viewer-overlay" role="status">
            <span className="tag text-sm">{isLoading ? "Reading photo…" : "Drop to replace this wall"}</span>
          </div>
        )}
      </div>

      <figcaption className="viewer-caption">
        {color ? (
          <span className="route-chip" style={{ background: color.fill, color: color.onFill }}>
            {route.name.trim() || `${color.label} route`}
            {route.grade.trim() && <span className="route-chip-grade">{route.grade.trim()}</span>}
          </span>
        ) : (
          <span className="pixel text-[0.7rem] text-cream/75">Choose a route to climb</span>
        )}
        <DetectionStatusLine routeHoldCount={routeHolds.length} hasRoute={!!color} onRetry={redetect} />
      </figcaption>
    </figure>
  );
}

function DetectionStatusLine({ routeHoldCount, hasRoute, onRetry }: { routeHoldCount: number; hasRoute: boolean; onRetry: () => void }) {
  const { detection } = useBetaSession();

  if (detection.status === "loading") {
    return (
      <span className="pixel flex items-center gap-2 text-[0.66rem] text-gold" role="status">
        <ScanSearch size={14} strokeWidth={2.6} className="anim-wiggle" /> beta is finding holds…
      </span>
    );
  }
  if (detection.status === "error") {
    return (
      <span className="flex items-center gap-2" role="status">
        <span className="pixel text-[0.62rem] text-coral" title={detection.error ?? undefined}>
          Hold detection failed
        </span>
        <button type="button" className="caption-btn" onClick={onRetry}>
          <RotateCw size={13} strokeWidth={3} /> Retry
        </button>
      </span>
    );
  }
  if (detection.status === "ready") {
    const total = detection.holds.filter((h) => h.kind !== "volume").length;
    return (
      <span className="pixel text-[0.66rem] text-cream/75" role="status">
        {hasRoute ? `${routeHoldCount} route holds numbered` : `beta found ${total} holds`}
        {detection.cached ? " · saved" : ""}
      </span>
    );
  }
  if (detection.status === "unavailable") {
    return <span className="pixel text-[0.66rem] text-cream/60">Add a Gemini key to map holds</span>;
  }
  return <span className="pixel text-[0.66rem] text-cream/60">Wall ready to map</span>;
}
