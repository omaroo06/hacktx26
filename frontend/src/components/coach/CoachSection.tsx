import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUp, Eye, KeyRound, Plus, Sparkles, Wand2 } from "lucide-react";
import { useBetaSession } from "../../state/BetaSession";
import { getHoldColor } from "../../lib/holdColors";
import { HoldShape, Sparkle } from "../decor/Ornaments";
import { ClimberCard, tintFor } from "./ClimberCard";
import { ClimbReview, type SeekRequest } from "./ClimbReview";
import { CoachChat } from "./CoachChat";
import { CrewPanel } from "./CrewPanel";
import { MAX_CREW, displayName, useCrew } from "./useCrew";

export function CoachSection() {
  const { health, route, routeHolds, routeContext, wall } = useBetaSession();
  const { crew, update, add, removeClimber, setClip, analyze, analyzeAll, dossiers } = useCrew();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  const reviewed = crew.filter((c) => c.report);
  const active = reviewed.find((c) => c.id === activeId) ?? reviewed[0] ?? null;
  const indexOf = (id: string) => crew.findIndex((c) => c.id === id);
  const names = useMemo(() => crew.map((c, i) => ({ id: c.id, name: displayName(c, i) })), [crew]);

  const geminiBlocked = health === null ? "Start the beta server" : !health.gemini.ready ? "Add a Gemini key" : null;
  const museBlocked = health === null ? "Start the beta server" : !health.muse.ready ? "Add a Meta API key" : null;
  const analyzeBlocked = geminiBlocked ?? museBlocked;
  const waiting = crew.filter((c) => c.clip && (c.stage === "idle" || c.stage === "error")).length;

  const goTo = (id: string, seconds?: number) => {
    setActiveId(id);
    if (seconds !== undefined) setSeek({ id, seconds, nonce: Date.now() });
    requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const color = route.color ? getHoldColor(route.color) : null;

  return (
    <section id="coach" className="coach-section" aria-labelledby="coach-title">
      <div className="relative mx-auto max-w-[var(--content-max)] px-[var(--space-gutter)]">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker text-coral">Chapter two · Coach</p>
            <h2 id="coach-title" className="section-title mt-3 text-forest">
              film it. <span className="title-stroke inline-block">get coached.</span>
            </h2>
            <p className="lede mt-4 max-w-xl text-ink/80">
              Upload a clip of your climb. Gemini watches every move, Muse Spark turns it into coaching, and your whole
              crew learns from each other's climbs.
            </p>
          </div>
          <div className="model-badges" aria-label="AI models">
            <ModelBadge icon={<Eye size={17} strokeWidth={2.6} />} tint="var(--color-sky)" name="Gemini" role="watches your climb" ready={health?.gemini.ready} model={health?.gemini.model} />
            <ModelBadge icon={<Sparkles size={17} strokeWidth={2.6} />} tint="var(--color-gold)" name="Muse Spark" role="coaches your crew" ready={health?.muse.ready} model={health?.muse.model} />
          </div>
        </header>

        {(health === null || !health.gemini.ready || !health.muse.ready) && <SetupNotice serverUp={health !== null} geminiReady={!!health?.gemini.ready} museReady={!!health?.muse.ready} />}

        <div className="route-strip" role="note">
          {color && wall.photo ? (
            <>
              <img src={wall.photo.url} alt="" className="route-strip-thumb" />
              <HoldShape fill={color.fill} shade={color.shade} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="pixel text-[0.6rem] text-ink/60">Climbing</p>
                <p className="display-text truncate text-[1.25rem] leading-tight">
                  {route.name.trim() || `${color.label} route`}
                  {route.grade.trim() ? ` · ${route.grade.trim()}` : ""}
                </p>
                <p className="text-[0.88rem] text-ink/70">
                  {routeHolds.length
                    ? `${routeHolds.length} holds numbered. The coach will point to them by number.`
                    : "Holds aren't mapped yet, so the coach will describe holds by position."}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="route-strip-empty" aria-hidden="true">
                <ArrowUp size={20} strokeWidth={3} />
              </span>
              <p className="min-w-[12rem] flex-1 text-[0.95rem]">
                <strong>Optional:</strong> map your wall and set a route above first. Then the coach can say "hold 4" instead
                of "that red one on the left."
              </p>
              <a href="#wall" className="btn btn-paper btn-sm shrink-0">
                Map the wall
              </a>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[1.9rem] text-forest">your crew.</h3>
            <p className="text-[0.95rem] text-ink/70">Up to {MAX_CREW} climbers. Same wall, different bodies, different beta.</p>
          </div>
          {crew.length > 1 && (
            <button type="button" className="btn btn-gold" onClick={() => void analyzeAll()} disabled={!waiting || !!analyzeBlocked}>
              <Wand2 size={19} strokeWidth={2.6} />
              Coach everyone{waiting ? ` (${waiting})` : ""}
            </button>
          )}
        </div>

        <div className="crew-grid mt-5">
          {crew.map((c, i) => (
            <ClimberCard
              key={c.id}
              climber={c}
              index={i}
              canRemove={crew.length > 1 || !!c.clip}
              blockedReason={analyzeBlocked}
              onChange={(patch) => update(c.id, patch)}
              onClip={(file) => setClip(c.id, file)}
              onRemove={() => removeClimber(c.id)}
              onAnalyze={() => void analyze(c.id).then(() => setActiveId(c.id))}
              onView={() => goTo(c.id)}
            />
          ))}
          {crew.length < MAX_CREW && (
            <button type="button" className="add-climber" onClick={add}>
              <span className="add-climber-icon" aria-hidden="true">
                <Plus size={26} strokeWidth={3} />
              </span>
              <span className="display-text text-[1.3rem]">add a friend.</span>
              <span className="max-w-[16rem] text-[0.88rem] text-ink/65">
                Compare climbs on the same wall and the coach will pair you up.
              </span>
            </button>
          )}
        </div>

        <div ref={reviewRef} className="scroll-mt-28">
          {active && (
            <div className="mt-12">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h3 className="flex items-center gap-2 text-[1.9rem] text-forest">
                  <Sparkle size={20} /> the review.
                </h3>
                {reviewed.length > 1 && (
                  <div className="review-tabs" role="tablist" aria-label="Whose climb">
                    {reviewed.map((c) => {
                      const i = indexOf(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="tab"
                          aria-selected={c.id === active.id}
                          className="review-tab"
                          style={{ "--tint": tintFor(i) } as CSSProperties}
                          onClick={() => setActiveId(c.id)}
                        >
                          {displayName(c, i)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <ClimbReview
                key={active.id}
                climber={active}
                name={displayName(active, indexOf(active.id))}
                seek={seek}
                geminiModel={health?.gemini.model ?? null}
                museModel={health?.muse.model ?? null}
              />
            </div>
          )}
        </div>

        <div className="coach-lower mt-12">
          <CrewPanel dossiers={dossiers} route={routeContext} indexOf={indexOf} onSeek={goTo} blockedReason={museBlocked} />
          <CoachChat dossiers={dossiers} names={names} route={routeContext} onSeek={goTo} blockedReason={museBlocked} />
        </div>
      </div>
    </section>
  );
}

function ModelBadge({ icon, tint, name, role, ready, model }: { icon: ReactNode; tint: string; name: string; role: string; ready?: boolean; model?: string }) {
  const state = ready === undefined ? "unknown" : ready ? "ready" : "missing";
  return (
    <div className="model-badge" title={model ? `${name} · ${model}` : name}>
      <span className="model-badge-icon" style={{ "--tint": tint } as CSSProperties} aria-hidden="true">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="model-badge-name">{name}</span>
        <span className="model-badge-role">{role}</span>
      </span>
      <span className={`status-dot is-${state}`} role="img" aria-label={state === "ready" ? "connected" : state === "missing" ? "API key missing" : "server not reachable"} />
    </div>
  );
}

function SetupNotice({ serverUp, geminiReady, museReady }: { serverUp: boolean; geminiReady: boolean; museReady: boolean }) {
  return (
    <div className="setup-notice" role="note">
      <KeyRound size={22} strokeWidth={2.4} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="display-text text-[1.2rem] leading-tight">{serverUp ? "one more step: add your keys." : "start the beta server."}</p>
        {serverUp ? (
          <p className="mt-1 text-[0.93rem] text-ink/75">
            Put {[!geminiReady && <code key="g">GEMINI_API_KEY</code>, !museReady && <code key="m">MODEL_API_KEY</code>].filter(Boolean).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, " and ", el] : [el]), [])} in the <code>.env</code> file
            next to <code>package.json</code>, then restart <code>npm run dev</code>.
          </p>
        ) : (
          <p className="mt-1 text-[0.93rem] text-ink/75">
            The coach runs on a small server that keeps your API keys private. In the project folder, run <code>npm run dev</code>, then refresh this page.
          </p>
        )}
      </div>
    </div>
  );
}
