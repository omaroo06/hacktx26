import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CheckCircle2, Dumbbell, Eye, Footprints, Hand, Info, ListChecks, Sparkles, TriangleAlert } from "lucide-react";
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

  const actions = { onSeek: seekTo, onHold: showWall ? setHighlightHold : undefined };

  return (
    <div className="review anim-pop-in">
      {/* ---------------- What Gemini saw ---------------- */}
      <section className="review-card" aria-labelledby={`seen-${climber.id}`}>
        <div className="review-card-head">
          <span className="review-icon" style={{ "--tint": "var(--color-sky)" } as CSSProperties}>
            <Eye size={18} strokeWidth={2.6} />
          </span>
          <div className="min-w-0">
            <p className="pixel text-[0.62rem] text-ink/60">Gemini · {climber.visionModel ?? geminiModel ?? "vision"}</p>
            <h4 id={`seen-${climber.id}`} className="text-[1.6rem] leading-tight">
              what gemini saw.
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

        <p className="mt-4 text-[0.98rem]">{report.summary}</p>
        {report.visibility.quality !== "good" && (
          <p className="visibility-note">
            <Info size={15} strokeWidth={2.6} className="mt-0.5 shrink-0" />
            <span>
              <strong>{report.visibility.quality === "poor" ? "Hard to see:" : "Partly hidden:"}</strong> {report.visibility.notes}
            </span>
          </p>
        )}

        <ul className="obs-list" role="list">
          {report.observations.map((o, i) => (
            <li
              key={i}
              className={`obs tone-${o.tone}`}
              onMouseEnter={() => o.holdNumber && showWall && setHighlightHold(o.holdNumber)}
              onMouseLeave={() => showWall && setHighlightHold(null)}
            >
              <TimeChip t={o.t} onSeek={seekTo} />
              <div className="min-w-0">
                <p className="pixel text-[0.58rem] text-ink/60">
                  {TONE_LABEL[o.tone]} · {o.category.replace("-", " ")}
                  {o.holdNumber ? ` · hold ${o.holdNumber}` : ""}
                  {o.confidence === "low" ? " · low confidence" : ""}
                </p>
                <p className="text-[0.95rem] leading-snug">{o.detail}</p>
              </div>
            </li>
          ))}
          {!report.observations.length && <li className="text-[0.95rem] text-ink/65">Gemini didn't flag any technique moments in this clip.</li>}
        </ul>

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
                      <span className="hold-ref" onMouseEnter={() => setHighlightHold(m.holdNumber)} onMouseLeave={() => setHighlightHold(null)}>
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

        {feedback ? <Feedback feedback={feedback} actions={actions} /> : <p className="mt-4 text-ink/70">The coach hasn't written notes for this climb yet.</p>}
        {climber.coachCached && <p className="pixel mt-3 text-[0.56rem] text-ink/45">Saved notes · the coach was unreachable, so these are from the last run</p>}
      </section>
    </div>
  );
}

function Feedback({ feedback, actions }: { feedback: CoachFeedback; actions: { onSeek: (s: number) => void; onHold?: (n: number | null) => void } }) {
  return (
    <div className="mt-4 flex flex-col gap-5">
      <p className="feedback-headline">{feedback.headline}</p>

      {feedback.strengths.length > 0 && (
        <div>
          <p className="field-label flex items-center gap-1.5">
            <CheckCircle2 size={14} strokeWidth={3} /> What worked
          </p>
          <ul className="flex flex-col gap-2.5" role="list">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="feedback-item tone-strength" onMouseEnter={() => s.holdNumber && actions.onHold?.(s.holdNumber)} onMouseLeave={() => actions.onHold?.(null)}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-extrabold leading-snug">{s.title}</p>
                  {s.t && <TimeChip t={s.t} onSeek={actions.onSeek} />}
                </div>
                <p className="mt-1 text-[0.95rem] leading-snug">
                  <RichInline text={s.detail} actions={actions} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.fixes.length > 0 && (
        <div>
          <p className="field-label flex items-center gap-1.5">
            <TriangleAlert size={14} strokeWidth={3} /> Work on
          </p>
          <ul className="flex flex-col gap-2.5" role="list">
            {feedback.fixes.map((f, i) => (
              <li key={i} className="feedback-item tone-issue" onMouseEnter={() => f.holdNumber && actions.onHold?.(f.holdNumber)} onMouseLeave={() => actions.onHold?.(null)}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-extrabold leading-snug">{f.title}</p>
                  {f.t && <TimeChip t={f.t} onSeek={actions.onSeek} />}
                </div>
                <p className="mt-1 text-[0.95rem] leading-snug">
                  <RichInline text={f.detail} actions={actions} />
                </p>
                {f.drill && (
                  <p className="drill">
                    <Dumbbell size={16} strokeWidth={2.6} className="mt-0.5 shrink-0" />
                    <span>
                      <span className="pixel mr-1 text-[0.6rem]">Drill</span> {f.drill}
                    </span>
                  </p>
                )}
              </li>
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
                <span>
                  <RichInline text={s} actions={actions} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.confidenceNote && (
        <p className="visibility-note">
          <Hand size={15} strokeWidth={2.6} className="mt-0.5 shrink-0" />
          <span>{feedback.confidenceNote}</span>
        </p>
      )}
    </div>
  );
}

/** Short model text with clickable timestamps and hold references (no block elements). */
function RichInline({ text, actions }: { text: string; actions: { onSeek: (s: number) => void; onHold?: (n: number | null) => void } }) {
  return <>{inline(text.replace(/\*\*/g, ""), actions)}</>;
}

function Timeline({ observations, duration, now, onSeek }: { observations: ClimbObservation[]; duration: number; now: number; onSeek: (s: number) => void }) {
  const pct = (s: number) => `${Math.min(100, Math.max(0, (s / duration) * 100))}%`;
  return (
    <div className="timeline" role="group" aria-label="Moments Gemini flagged, on the clip's timeline">
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
