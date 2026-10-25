import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CircleAlert, Sun, Maximize, MoveHorizontal, CheckCircle2, X } from "lucide-react";
import { useFileDrop } from "../../hooks/useFileDrop";
import { EMPTY_ROUTE, useBetaSession } from "../../state/BetaSession";
import { ACCEPT_ATTRIBUTE } from "../../lib/imageValidation";
import { UploadZone } from "./UploadZone";
import { WallViewer } from "./WallViewer";
import { RouteSelector } from "./RouteSelector";
import { RouteTicket } from "./RouteTicket";
import { QuestSteps, type QuestStep } from "./QuestSteps";
import { Sparkle } from "../decor/Ornaments";

const TIPS = [
  { icon: Maximize, title: "Fit the whole wall", body: "Keep the floor and top edge in frame so every hold is visible." },
  { icon: MoveHorizontal, title: "Shoot straight on", body: "Stand back and face the wall squarely to limit perspective tilt." },
  { icon: Sun, title: "Even light", body: "Avoid harsh shadows and glare so hold colors read true." },
];

export function WallWorkspace() {
  const { wall, route, setRoute, detection } = useBetaSession();
  const { photo, status, error, loadFiles, remove, clearError } = wall;
  const [step, setStep] = useState<QuestStep>("capture");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isDragging, dropHandlers } = useFileDrop(loadFiles);

  const browse = useCallback(() => inputRef.current?.click(), []);

  const goTo = (next: QuestStep) => {
    setStep(next);
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  };

  const handleRemove = () => {
    remove();
    setRoute(EMPTY_ROUTE);
    setStep("capture");
  };

  useEffect(() => {
    if (!photo) setStep("capture");
  }, [photo]);

  const isLoading = status === "loading";

  return (
    <section id="wall" className="workspace-section" aria-labelledby="wall-title">
      <div className="absolute inset-0 halftone-light opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_40%)]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[var(--content-max)] px-[var(--space-gutter)]">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker text-gold">Base camp · Workspace</p>
            <h2 id="wall-title" className="section-title mt-3 text-cream">
              map your <span className="text-gold">climbing wall.</span>
            </h2>
            <p className="lede mt-4 max-w-xl text-cream/85">
              Bring a photo of a real bouldering wall, choose the colored route you want to climb, and give it a name.
              Every <span className="brand">beta</span> adventure begins here.
            </p>
          </div>
          <QuestSteps current={step} hasPhoto={!!photo} />
        </header>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            loadFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="workspace-grid">
          <div className="workspace-canvas" {...dropHandlers}>
            {photo ? (
              <WallViewer
                photo={photo}
                route={route}
                isDragging={isDragging}
                isLoading={isLoading}
                onReplace={browse}
                onRemove={handleRemove}
              />
            ) : (
              <UploadZone onBrowse={browse} isDragging={isDragging} isLoading={isLoading} />
            )}

            <div aria-live="polite" className="empty:hidden">
              {error && (
                <div className="alert anim-pop-in" role="alert">
                  <CircleAlert size={22} strokeWidth={2.6} className="shrink-0" />
                  <p className="flex-1 font-bold">{error}</p>
                  <button type="button" className="alert-close" onClick={clearError} aria-label="Dismiss message">
                    <X size={18} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="workspace-panel panel rivets parchment" aria-label="Route setup">
            <div ref={panelRef} tabIndex={-1} className="outline-none">
              {step === "capture" && (
                <div className="anim-pop-in" key="capture">
                  <p className="section-kicker text-forest/70">Step 01 · Capture</p>
                  <h3 className="card-title mt-2">
                    {photo ? "wall captured." : "field notes for a good photo."}
                  </h3>

                  {photo ? (
                    <div className="mt-4 flex items-start gap-3 rounded-[var(--r-md)] border-[3px] border-ink bg-mint/60 p-4">
                      <CheckCircle2 size={22} strokeWidth={2.6} className="mt-0.5 shrink-0" />
                      <p className="text-[0.98rem]">
                        {detection.status === "loading"
                          ? "Looking good. Gemini is marking every hold on your photo while you choose a route."
                          : detection.status === "ready"
                            ? `Looking good. Gemini found ${detection.holds.length} holds. Choose which colored route you want to climb.`
                            : "Looking good. Check the preview, then choose which colored route you want to climb."}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-ink/75">A clear photo makes every hold on your route easier to find.</p>
                  )}

                  <ul className="mt-6 flex flex-col gap-4" role="list">
                    {TIPS.map(({ icon: Icon, title, body }) => (
                      <li key={title} className="flex gap-3.5">
                        <span className="tip-icon">
                          <Icon size={18} strokeWidth={2.6} />
                        </span>
                        <span>
                          <span className="block font-extrabold leading-snug">{title}</span>
                          <span className="block text-[0.95rem] text-ink/70">{body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 border-t-[3px] border-dashed border-ink/20 pt-6">
                    {photo ? (
                      <button type="button" className="btn btn-gold w-full" onClick={() => goTo("route")}>
                        Choose your route
                        <ArrowRight size={20} strokeWidth={3} className="btn-arrow" />
                      </button>
                    ) : (
                      <button type="button" className="btn btn-forest w-full" onClick={browse} disabled={isLoading}>
                        Upload a wall photo
                        <ArrowRight size={20} strokeWidth={3} className="btn-arrow" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {step === "route" && photo && (
                <div className="anim-pop-in" key="route">
                  <p className="section-kicker text-forest/70">Step 02 · Discover</p>
                  <h3 className="card-title mb-6 mt-2">discover your route.</h3>
                  <RouteSelector
                    route={route}
                    onChange={(patch) => setRoute((r) => ({ ...r, ...patch }))}
                    onBack={() => goTo("capture")}
                    onConfirm={() => goTo("ticket")}
                  />
                </div>
              )}

              {step === "ticket" && photo && (
                <div key="ticket">
                  <p className="section-kicker flex items-center gap-2 text-forest/70">
                    <Sparkle size={14} /> Route set
                  </p>
                  <h3 className="card-title mb-6 mt-2">your route is ready.</h3>
                  <RouteTicket photo={photo} route={route} onEdit={() => goTo("route")} onStartOver={handleRemove} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
