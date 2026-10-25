import { useState, type CSSProperties } from "react";
import { ArrowRight, CircleAlert, Flag, LoaderCircle, Trophy, Users } from "lucide-react";
import type { ClimberDossier, CrewRecap, RouteContext } from "../../types/coach";
import { api } from "../../services/api";
import { TimeChip, inline } from "./RichText";
import { tintFor } from "./ClimberCard";

interface CrewPanelProps {
  dossiers: (ClimberDossier & { id: string })[];
  route: RouteContext | null;
  /** Index of each climber in the crew, for their color. */
  indexOf: (id: string) => number;
  onSeek: (id: string, seconds: number) => void;
  blockedReason: string | null;
}

export function CrewPanel({ dossiers, route, indexOf, onSeek, blockedReason }: CrewPanelProps) {
  const [recap, setRecap] = useState<CrewRecap | null>(null);
  const [forKey, setForKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = dossiers.filter((d) => d.feedback);
  const key = ready.map((d) => `${d.id}:${d.climber.name}`).join("|");
  const stale = recap !== null && forKey !== key;

  const idByName = (name: string) => ready.find((d) => d.climber.name.toLowerCase() === name.trim().toLowerCase())?.id;
  const tintByName = (name: string) => {
    const id = idByName(name);
    return id ? tintFor(indexOf(id)) : "var(--color-cream)";
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { crew } = await api.crew({ route, crew: ready.map(({ climber, report, feedback }) => ({ climber, report, feedback })) });
      setRecap(crew);
      setForKey(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="review-card crew-card" aria-labelledby="crew-title">
      <div className="review-card-head">
        <span className="review-icon" style={{ "--tint": "var(--color-lavender)" } as CSSProperties}>
          <Users size={18} strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <p className="pixel text-[0.62rem] text-ink/60">Muse Spark · crew session</p>
          <h3 id="crew-title" className="text-[1.75rem] leading-tight">
            learn from your crew.
          </h3>
        </div>
      </div>

      {ready.length < 2 ? (
        <div className="crew-empty">
          <div className="flex -space-x-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="climber-avatar is-ghost" style={{ "--tint": tintFor(i) } as CSSProperties}>
                ?
              </span>
            ))}
          </div>
          <p className="text-[0.98rem]">
            Add a friend's clip on the same wall. Once two climbs are coached, Muse Spark finds who should show whom
            which move, pairs you up, and plans your next session together.
          </p>
          <p className="pixel text-[0.6rem] text-ink/55">{ready.length} of 2 climbs coached</p>
        </div>
      ) : (
        <>
          {!recap && !loading && (
            <p className="mt-4 text-[0.98rem]">
              {ready.map((d) => d.climber.name).join(", ")} are ready. The coach will compare your climbs and turn them
              into a session you do together.
            </p>
          )}

          {recap && (
            <div className={`mt-4 flex flex-col gap-5 ${stale ? "opacity-60" : ""}`}>
              <p className="feedback-headline text-[1.25rem]">{inline(recap.recap, {})}</p>

              {recap.highlights.length > 0 && (
                <div>
                  <p className="field-label">Teach each other</p>
                  <ul className="flex flex-col gap-2.5" role="list">
                    {recap.highlights.map((h, i) => {
                      const fromId = idByName(h.from);
                      return (
                        <li key={i} className="teach">
                          <span className="teach-names">
                            <span className="name-pill" style={{ "--tint": tintByName(h.from) } as CSSProperties}>
                              {h.from}
                            </span>
                            <ArrowRight size={16} strokeWidth={3} aria-label="shows" />
                            <span className="name-pill" style={{ "--tint": tintByName(h.to) } as CSSProperties}>
                              {h.to}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1 text-[0.95rem] leading-snug">{h.skill}</span>
                          {h.t && fromId && <TimeChip t={h.t} onSeek={(s) => onSeek(fromId, s)} label={`Watch ${h.from} at ${h.t}`} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {recap.pairings.length > 0 && (
                <div>
                  <p className="field-label">Climb together</p>
                  <ul className="flex flex-col gap-2" role="list">
                    {recap.pairings.map((p, i) => (
                      <li key={i} className="pairing">
                        <span className="flex flex-wrap gap-1.5">
                          {p.climbers.map((n) => (
                            <span key={n} className="name-pill" style={{ "--tint": tintByName(n) } as CSSProperties}>
                              {n}
                            </span>
                          ))}
                        </span>
                        <span className="text-[0.93rem] leading-snug text-ink/80">{p.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recap.sessionPlan.length > 0 && (
                <div>
                  <p className="field-label">Next session, together</p>
                  <ol className="plan-list">
                    {recap.sessionPlan.map((s, i) => (
                      <li key={i}>
                        <span className="plan-num">{i + 1}</span>
                        <span className="min-w-0 flex-1 leading-snug">{s.step}</span>
                        <span className="tag shrink-0">{s.who}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {recap.challenge && (
                <p className="challenge">
                  <Trophy size={20} strokeWidth={2.6} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="pixel mr-1.5 text-[0.62rem]">Crew challenge</span>
                    {recap.challenge}
                  </span>
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="alert alert-sm mt-4" role="alert">
              <CircleAlert size={18} strokeWidth={2.6} className="mt-0.5 shrink-0" />
              <p className="flex-1 text-[0.9rem] font-bold">{error}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-coral" onClick={run} disabled={loading || !!blockedReason}>
              {loading ? <LoaderCircle size={18} strokeWidth={2.8} className="spin" /> : <Flag size={18} strokeWidth={2.8} />}
              {loading ? "Planning your session…" : recap ? (stale ? "Update for the new crew" : "Write it again") : "Plan our crew session"}
            </button>
            {blockedReason && <span className="pixel text-[0.6rem] text-coral">{blockedReason}</span>}
          </div>
        </>
      )}
    </section>
  );
}
