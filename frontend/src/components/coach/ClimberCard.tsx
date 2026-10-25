import { useRef, useState, type CSSProperties } from "react";
import { Check, CircleAlert, Eye, FileJson, Film, LoaderCircle, MessageSquareText, RotateCw, Sparkles, X } from "lucide-react";
import type { Experience } from "../../types/coach";
import { useFileDrop } from "../../hooks/useFileDrop";
import { CLIP_ACCEPT, displayName, type Climber } from "./useCrew";

const TINTS = ["var(--color-gold)", "var(--color-sky)", "var(--color-mint)", "var(--color-lavender)"];
export const tintFor = (index: number) => TINTS[index % TINTS.length];

const EXPERIENCE: { id: Experience; label: string }[] = [
  { id: "new", label: "New" },
  { id: "intermediate", label: "Regular" },
  { id: "advanced", label: "Strong" },
];

interface ClimberCardProps {
  climber: Climber;
  index: number;
  canRemove: boolean;
  blockedReason: string | null;
  onChange: (patch: Partial<Climber>) => void;
  onClip: (file: File | null) => string | null;
  onRemove: () => void;
  onAnalyze: () => void;
  onView: () => void;
}

export function ClimberCard({ climber: c, index, canRemove, blockedReason, onChange, onClip, onRemove, onAnalyze, onView }: ClimberCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const poseRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const name = displayName(c, index);
  const busy = c.stage === "watching" || c.stage === "coaching";
  const idBase = `climber-${c.id}`;

  const takeFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setLocalError(onClip(file));
  };
  const { isDragging, dropHandlers } = useFileDrop(takeFiles);

  const readPose = async (file: File | undefined) => {
    if (!file) return;
    try {
      // Re-coaching with measurements reuses Gemini's report; only Muse runs again.
      onChange({ poseReport: JSON.parse(await file.text()), poseFileName: file.name, feedback: null, stage: c.report ? "idle" : c.stage });
      setLocalError(null);
    } catch {
      setLocalError(`“${file.name}” isn't valid JSON. Export observations.json from the AI Mentor again.`);
    }
  };

  return (
    <article className="climber-card anim-pop-in" style={{ "--tint": tintFor(index) } as CSSProperties} aria-labelledby={`${idBase}-title`}>
      <header className="climber-card-head">
        <span className="climber-avatar" aria-hidden="true">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h4 id={`${idBase}-title`} className="sr-only">
            {name}
          </h4>
          <label htmlFor={`${idBase}-name`} className="sr-only">
            Climber name
          </label>
          <input
            id={`${idBase}-name`}
            className="name-input"
            value={c.name}
            maxLength={24}
            autoComplete="off"
            placeholder={index === 0 ? "Your name" : `Friend ${index}`}
            onChange={(e) => onChange({ name: e.target.value })}
            disabled={busy}
          />
        </div>
        {canRemove && (
          <button type="button" className="icon-btn" onClick={onRemove} disabled={busy} aria-label={`Remove ${name} from the crew`}>
            <X size={16} strokeWidth={3} />
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <fieldset className="min-w-0">
          <legend className="field-label">Height</legend>
          <div className="ftin">
            <input aria-label="Height, feet" inputMode="numeric" className="field-input field-input-sm" placeholder="5" maxLength={1} value={c.heightFt} onChange={(e) => onChange({ heightFt: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            <span aria-hidden="true">ft</span>
            <input aria-label="Height, inches" inputMode="numeric" className="field-input field-input-sm" placeholder="9" maxLength={2} value={c.heightIn} onChange={(e) => onChange({ heightIn: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            <span aria-hidden="true">in</span>
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="field-label">
            Wingspan <span className="opacity-55">· opt.</span>
          </legend>
          <div className="ftin">
            <input aria-label="Wingspan, feet" inputMode="numeric" className="field-input field-input-sm" placeholder="5" maxLength={1} value={c.spanFt} onChange={(e) => onChange({ spanFt: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            <span aria-hidden="true">ft</span>
            <input aria-label="Wingspan, inches" inputMode="numeric" className="field-input field-input-sm" placeholder="11" maxLength={2} value={c.spanIn} onChange={(e) => onChange({ spanIn: e.target.value.replace(/\D/g, "") })} disabled={busy} />
            <span aria-hidden="true">in</span>
          </div>
        </fieldset>
      </div>

      <fieldset>
        <legend className="field-label">Experience</legend>
        <div className="seg" role="group">
          {EXPERIENCE.map((x) => (
            <button key={x.id} type="button" aria-pressed={c.experience === x.id} onClick={() => onChange({ experience: x.id })} disabled={busy}>
              {x.label}
            </button>
          ))}
        </div>
      </fieldset>

      <input
        ref={fileRef}
        type="file"
        accept={CLIP_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          takeFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {c.clip ? (
        <div className="clip-preview" {...dropHandlers}>
          <video src={c.clip.url} muted playsInline controls preload="metadata" aria-label={`${name}'s climbing clip`} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[0.85rem] font-bold" title={c.clip.file.name}>
              <Film size={14} strokeWidth={2.6} className="mr-1 inline align-[-2px]" />
              {c.clip.file.name}
            </span>
            <button type="button" className="link-btn shrink-0 text-[0.88rem]" onClick={() => fileRef.current?.click()} disabled={busy}>
              Replace
            </button>
          </div>
          {isDragging && <div className="clip-drop-hint">Drop to replace</div>}
        </div>
      ) : (
        <button type="button" className={`clip-drop ${isDragging ? "is-dragging" : ""}`} onClick={() => fileRef.current?.click()} {...dropHandlers}>
          <Film size={28} strokeWidth={2.2} aria-hidden="true" />
          <span className="display-text text-[1.25rem] leading-tight">{isDragging ? "drop the clip." : "add a climbing clip."}</span>
          <span className="text-[0.85rem] text-ink/65">MP4 or MOV · film the whole wall, steady</span>
        </button>
      )}

      <details className="pose-peek">
        <summary>
          <FileJson size={15} strokeWidth={2.6} /> AI Mentor pose report <span className="opacity-55">· optional</span>
        </summary>
        <p className="mt-2 text-[0.85rem] text-ink/70">
          Attach the <code>observations.json</code> the MediaPipe AI Mentor exports. The coach treats its elbow angles as measured data.
        </p>
        <input ref={poseRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(e) => { void readPose(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-paper btn-sm" onClick={() => poseRef.current?.click()} disabled={busy}>
            {c.poseFileName ? "Replace report" : "Attach report"}
          </button>
          {c.poseFileName && (
            <span className="tag">
              {c.poseFileName}
              <button type="button" className="tag-x" aria-label="Remove pose report" onClick={() => onChange({ poseReport: null, poseFileName: null })}>
                <X size={11} strokeWidth={3.5} />
              </button>
            </span>
          )}
        </div>
      </details>

      {(localError || c.error) && (
        <div className="alert alert-sm" role="alert">
          <CircleAlert size={18} strokeWidth={2.6} className="mt-0.5 shrink-0" />
          <p className="flex-1 text-[0.9rem] font-bold">{localError ?? c.error}</p>
        </div>
      )}

      <footer className="climber-card-foot">
        <StageTrack stage={c.stage} hasReport={!!c.report} />
        {c.stage === "done" ? (
          <button type="button" className="btn btn-mint btn-sm w-full" onClick={onView}>
            <MessageSquareText size={17} strokeWidth={2.6} />
            Read {index === 0 && !c.name.trim() ? "your" : `${name}'s`} notes
          </button>
        ) : busy ? (
          <button type="button" className="btn btn-paper btn-sm w-full" disabled aria-live="polite">
            <LoaderCircle size={17} strokeWidth={2.8} className="spin" />
            {c.stage === "watching" ? "Gemini is watching…" : "Muse Spark is coaching…"}
          </button>
        ) : (
          <button type="button" className="btn btn-gold btn-sm w-full" onClick={onAnalyze} disabled={!c.clip || !!blockedReason} title={blockedReason ?? undefined}>
            {c.stage === "error" ? <RotateCw size={17} strokeWidth={2.8} /> : <Sparkles size={17} strokeWidth={2.6} />}
            {c.stage === "error" ? (c.report ? "Retry coaching" : "Try again") : "Coach this climb"}
          </button>
        )}
        {!c.clip && <p className="pixel text-center text-[0.58rem] text-ink/55">Add a clip first</p>}
        {c.clip && blockedReason && c.stage !== "done" && <p className="pixel text-center text-[0.58rem] text-coral">{blockedReason}</p>}
      </footer>
    </article>
  );
}

function StageTrack({ stage, hasReport }: { stage: Climber["stage"]; hasReport: boolean }) {
  const steps = [
    { id: "watch", label: "Watch", icon: Eye, done: hasReport, active: stage === "watching" },
    { id: "coach", label: "Coach", icon: Sparkles, done: stage === "done", active: stage === "coaching" },
  ];
  return (
    <ol className="stage-track" aria-label="Analysis progress">
      {steps.map(({ id, label, icon: Icon, done, active }) => (
        <li key={id} className={`stage-pill ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}>
          {done ? <Check size={12} strokeWidth={4} /> : <Icon size={12} strokeWidth={3} />}
          {label}
        </li>
      ))}
    </ol>
  );
}
