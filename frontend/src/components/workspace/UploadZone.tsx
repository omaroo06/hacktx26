import { ImagePlus } from "lucide-react";
import { MAX_FILE_BYTES, formatBytes } from "../../lib/imageValidation";

interface UploadZoneProps {
  onBrowse: () => void;
  isDragging: boolean;
  isLoading: boolean;
}

function FramedPeak() {
  return (
    <svg viewBox="0 0 160 120" className="upload-art" aria-hidden="true">
      <g transform="rotate(-6 80 60)">
        <rect x="22" y="14" width="116" height="92" rx="8" fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="3.5" />
        <rect x="32" y="24" width="96" height="62" rx="4" fill="var(--color-sky)" stroke="var(--color-ink)" strokeWidth="3" />
        <circle cx="106" cy="40" r="8" fill="var(--color-gold)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <path d="M32 86 L62 46 L78 66 L92 52 L128 86 Z" fill="var(--color-sand)" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M62 46 L68 54 L62 52 L57 55 Z" fill="var(--color-paper)" />
        <circle cx="58" cy="74" r="3.6" fill="var(--color-coral)" stroke="var(--color-ink)" strokeWidth="2" />
        <circle cx="70" cy="62" r="3.2" fill="var(--color-mint)" stroke="var(--color-ink)" strokeWidth="2" />
        <circle cx="96" cy="72" r="3.4" fill="var(--color-lavender)" stroke="var(--color-ink)" strokeWidth="2" />
      </g>
      <g className="upload-art-pin">
        <circle cx="80" cy="12" r="7" fill="var(--color-coral)" stroke="var(--color-ink)" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function UploadZone({ onBrowse, isDragging, isLoading }: UploadZoneProps) {
  return (
    <div className={`upload-zone ${isDragging ? "is-dragging" : ""}`}>
      <button
        type="button"
        className="upload-hit"
        onClick={onBrowse}
        disabled={isLoading}
        aria-describedby="upload-hint"
      >
        <span className="sr-only">Upload a climbing wall photo</span>
      </button>

      <div className="upload-content" aria-hidden="true">
        <FramedPeak />
        <p className="section-kicker text-forest/70">{isDragging ? "Release to drop" : "Chapter one"}</p>
        <h3 className="mt-2 text-[clamp(1.65rem,3.1vw,2.4rem)] leading-[1.08]">
          {isLoading ? "reading your wall." : isDragging ? "drop it right here." : "drop your wall photo here."}
        </h3>
        <p className="mx-auto mt-3 max-w-sm text-ink/75">
          Snap the whole wall, straight on. Your photo stays right here on your device.
        </p>
        <span className="btn btn-forest btn-sm mt-6 pointer-events-none">
          <ImagePlus size={18} strokeWidth={2.6} />
          Browse files
        </span>
      </div>

      <p id="upload-hint" className="upload-hint">
        <span className="tag">JPG</span>
        <span className="tag">JPEG</span>
        <span className="tag">PNG</span>
        <span className="pixel text-[0.68rem] text-ink/70">Up to {formatBytes(MAX_FILE_BYTES)}</span>
      </p>
    </div>
  );
}
