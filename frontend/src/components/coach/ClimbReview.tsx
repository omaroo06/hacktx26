import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, Dumbbell, Eye, Footprints, Info, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
import type { ClimbObservation, CoachFeedback, ObservationTone, VisionReport } from "../../types/coach";
import { useBetaSession } from "../../state/BetaSession";
import { HoldOverlay } from "../workspace/HoldOverlay";
import { TimeChip, inline } from "./RichText";
import type { Climber } from "./useCrew";

export interface SeekRequest {
  id: string;
  seconds: number;
  nonce: number;
}

interface ClimbReviewProps {
  climber: Climber;
  name: string;
  seek: SeekRequest | null;
  geminiModel: string | null;
  museModel: string | null;
}

type Actions = { onSeek: (s: number) => void; onHold?: (n: number | null) => void };
type HoverProps = { onMouseEnter?: () => void; onMouseLeave?: () => void };

const TONE_LABEL: Record<ObservationTone, string> = { strength: "Strength", issue: "Work on", note: "Note" };
const OUTCOME_LABEL: Record<VisionReport["outcome"], string> = {
  sent: "Sent it",
  fell: "Fell",
  "stepped off": "Stepped off",
  unclear: "Outcome unclear",
};

export function ClimbReview({ climber, name, seek, geminiModel, museModel }: ClimbReviewProps) {
  const { wall, detection, route, routeHolds, highlightHold, setHighlightHold } = useBetaSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const report = climber.report!;
  const feedback = climber.feedback;
  // The real file length beats the model's estimate.
  const duration = videoDuration || report.durationSeconds || 1;
  const showWall = Boolean(wall.photo && routeHolds.length && report.sameWallAsPhoto !== false);

  const seekTo = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, seconds - 0.5);
    void v.play().catch(() => undefined);
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    if (seek && seek.id === climber.id) seekTo(seek.seconds);
  }, [seek, climber.id]);

  const actions: Actions = { onSeek: seekTo, onHold: showWall ? setHighlightHold : undefined };
  const holdHover = (n: number | null): HoverProps =>
    showWall && n ? { onMouseEnter: () => setHighlightHold(n), onMouseLeave: () => setHighlightHold(null) } : {};

  return (
    <div className="review anim-pop-in">
      {/* ---------------- What beta saw ---------------- */}
      <section className="review-card" aria-labelledby={`seen-${climber.id}`}>
        <div className="review-card-head">
          <span className="review-icon" style={{ "--tint": "var(--color-sky)" } as CSSProperties}>
            <Eye size={18} strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <p className="pixel text-[0.62rem] text-ink/60">Vision · {climber.visionModel ?? geminiModel ?? "Gemini"}</p>
            <h4 id={`seen-${climber.id}`} className="text-[1.6rem] leading-tight">
              what <span className="brand">beta</span> saw.
            </h4>
          </div>
          <span className={`tag ml-auto outcome-${report.outcome.replace(" ", "-")}`}>{OUTCOME_LABEL[report.outcome]}</span>
        </div>

        <div className={`review-media ${showWall ? "has-wall" : ""}`}>
          <video
            ref={videoRef}
            src={climber.clip?.url}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setVideoDuration(e.currentTarget.duration)}
            aria-label={`${name}'s climb`}
          />
          {showWall && wall.photo && (
            <figure className="wall-mini" aria-label="Route map with numbered holds">
              <div className="wall-mini-photo">
                <img src={wall.photo.url} alt="" draggable={false} />
                <HoldOverlay holds={detection.holds} routeColor={route.color} routeHolds={routeHolds} highlight={highlightHold} onHover={setHighlightHold} compact />
              </div>
              <figcaption className="pixel text-[0.56rem] text-cream/70">Hover a hold number</figcaption>
            </figure>
          )}
        </div>

        <Timeline observations={report.observations} duration={duration} now={now} onSeek={seekTo} />

        <p className="mt-4 text-[0.98rem] leading-snug">{report.summary}</p>
        {report.visibility.quality !== "good" && report.visibility.notes && (
          <p className="visibility-note">
            <Info size={15} strokeWidth={2.6} className="mt-0.5 shrink-0" />
            <span>{report.visibility.notes}</span>
          </p>
        )}

        {report.observations.length > 0 ? (
          <div className="mt-5">
            <p className="field-label">Key moments · tap to open</p>
            <ul className="xlist" role="list">
              {report.observations.map((o, i) => (
                <Expandable
                  key={i}
                  tone={o.tone}
                  chip={<TimeChip t={o.t} onSeek={seekTo} />}
                  title={
                    <>
                      {TONE_LABEL[o.tone]} · {o.category.replace("-", " ")}
                      {o.holdNumber ? <span className="xrow-hold">hold {o.holdNumber}</span> : null}
                    </>
                  }
                  {...holdHover(o.holdNumber)}
                >
                  <p>{o.detail}</p>
                  {o.confidence === "low" && <p className="mt-1 pixel text-[0.56rem] text-ink/55">Low confidence: partly hidden in the video</p>}
                </Expandable>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-[0.95rem] text-ink/65">No technique moments flagged in this clip.</p>
        )}

        {report.moves.length > 0 && (
          <details className="data-peek mt-4">
            <summary>Move-by-move ({report.moves.length})</summary>
            <ol className="move-list">
              {report.moves.map((m, i) => (
                <li key={i}>
                  <TimeChip t={m.t} onSeek={seekTo} />
                  <span>
                    <span className="font-extrabold">{m.limb}</span> {m.action}
                    {m.holdNumber ? (
                      <span className="hold-ref" {...holdHover(m.holdNumber)}>
                        {" "}
                        hold {m.holdNumber}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        {climber.visionCached && <p className="pixel mt-3 text-[0.56rem] text-ink/45">Saved result · same clip as before</p>}
      </section>

      {/* ---------------- What the coach says ---------------- */}
      <section className="review-card review-card-coach" aria-labelledby={`notes-${climber.id}`}>
        <div className="review-card-head">
          <span className="review-icon" style={{ "--tint": "var(--color-gold)" } as CSSProperties}>
            <Sparkles size={18} strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <p className="pixel text-[0.62rem] text-ink/60">Muse Spark · {museModel ?? "coach"}</p>
            <h4 id={`notes-${climber.id}`} className="text-[1.6rem] leading-tight">
              coach's notes.
            </h4>
          </div>
        </div>

        {feedback ? <Feedback feedback={feedback} actions={actions} holdHover={holdHover} /> : <p className="mt-4 text-ink/70">The coach hasn't written notes for this climb yet.</p>}
        {climber.coachCached && <p className="pixel mt-3 text-[0.56rem] text-ink/45">Saved notes · the coach was unreachable, so these are from the last run</p>}
      </section>
    </div>
  );
}

function Feedback({
  feedback,
  actions,
  holdHover,
}: {
  feedback: CoachFeedback;
  actions: Actions;
  holdHover: (n: number | null) => HoverProps;
}) {
  const chip = (t: string | null) => (t ? <TimeChip t={t} onSeek={actions.onSeek} /> : <span className="time-chip is-static is-empty">—</span>);

  return (
    <div className="mt-4 flex flex-col gap-5">
      <p className="feedback-headline">{feedback.headline}</p>

      {feedback.strengths.length > 0 && (
        <div>
          <p className="field-label flex items-center gap-1.5">
            <CheckCircle2 size={14} strokeWidth={3} /> What worked
          </p>
          <ul className="xlist" role="list">
            {feedback.strengths.map((s, i) => (
              <Expandable key={i} tone="strength" chip={chip(s.t)} title={s.title} {...holdHover(s.holdNumber)}>
                <p>{inline(s.detail, actions)}</p>
              </Expandable>
            ))}
          </ul>
        </div>
      )}

      {feedback.fixes.length > 0 && (
        <div>
          <p className="field-label flex items-center gap-1.5">
            <TriangleAlert size={14} strokeWidth={3} /> Work on
          </p>
          <ul className="xlist" role="list">
            {feedback.fixes.map((f, i) => (
              <Expandable key={i} tone="issue" chip={chip(f.t)} title={f.title} {...holdHover(f.holdNumber)}>
                <p>{inline(f.detail, actions)}</p>
                {f.drill && (
                  <p className="drill">
                    <Dumbbell size={16} strokeWidth={2.6} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="pixel mr-1 text-[0.6rem]">Drill</span> {f.drill}
                    </span>
                  </p>
                )}
              </Expandable>
            ))}
          </ul>
        </div>
      )}

      {feedback.nextSession.length > 0 && (
        <div>
          <p className="field-label flex items-center gap-1.5">
            <ListChecks size={14} strokeWidth={3} /> Next session
          </p>
          <ul className="next-list" role="list">
            {feedback.nextSession.map((s, i) => (
              <li key={i}>
                <Footprints size={15} strokeWidth={2.6} className="mt-1 shrink-0" />
                <span>{inline(s, actions)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.confidenceNote && <p className="pixel text-[0.6rem] leading-relaxed text-ink/55">Note · {feedback.confidenceNote}</p>}
    </div>
  );
}

/** A one-line row that opens to show its details. The time chip outside the toggle seeks the video. */
function Expandable({
  tone,
  chip,
  title,
  children,
  onMouseEnter,
  onMouseLeave,
}: {
  tone: ObservationTone;
  chip: ReactNode;
  title: ReactNode;
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <li className={`xrow tone-${tone} ${open ? "is-open" : ""}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="xrow-head">
        {chip}
        <button type="button" className="xrow-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDown size={18} strokeWidth={3} className="xrow-chevron" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div id={bodyId} className="xrow-body">
          {children}
        </div>
      )}
    </li>
  );
}

function Timeline({ observations, duration, now, onSeek }: { observations: ClimbObservation[]; duration: number; now: number; onSeek: (s: number) => void }) {
  const pct = (s: number) => `${Math.min(100, Math.max(0, (s / duration) * 100))}%`;
  return (
    <div className="timeline" role="group" aria-label="Key moments on the clip's timeline">
      <span className="timeline-progress" style={{ width: pct(now) }} aria-hidden="true" />
      {observations.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`timeline-mark tone-${o.tone}`}
          style={{ left: pct(o.seconds) }}
          onClick={() => onSeek(o.seconds)}
          aria-label={`${o.t}: ${TONE_LABEL[o.tone]}, ${o.category}`}
          title={`${o.t} · ${o.detail}`}
        />
      ))}
    </div>
  );
}
