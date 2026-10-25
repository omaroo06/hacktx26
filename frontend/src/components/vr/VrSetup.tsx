import { Cable, Download, Glasses, Move, PersonStanding, type LucideIcon } from "lucide-react";
import { VrArt } from "../how/StageArt";
import { Sparkle } from "../decor/Ornaments";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Cable,
    title: "Connect your headset",
    body: "Turn on developer mode, then plug your Meta Quest 2 into your laptop with a USB-C cable.",
  },
  {
    icon: Download,
    title: "Install beta",
    body: "Open Meta Quest Developer Hub and drag the BetaVR app (.apk) onto your headset to install it.",
  },
  {
    icon: Move,
    title: "Clear your space",
    body: "Put the headset on and set a boundary with about 2 × 2 m of open floor.",
  },
  {
    icon: Glasses,
    title: "Open beta",
    body: "In the headset, go to Library → Unknown Sources → BetaVR.",
  },
  {
    icon: PersonStanding,
    title: "Explore your wall",
    body: "Your wall appears at true scale. Walk around it and watch the digital climber move through the route.",
  },
];

/** Stop 04: how to see the mapped wall in a Meta Quest 2. Its own dark section, like the wall workspace. */
export function VrSetup() {
  return (
    <section id="vr" className="vr-section-new" aria-labelledby="vr-title">
      <div className="absolute inset-0 halftone-light opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_45%)]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[var(--content-max)] px-[var(--space-gutter)]">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker text-gold">Stop 04 · VR</p>
            <h2 id="vr-title" className="section-title mt-3 text-cream">
              step into <span className="text-gold">VR.</span>
            </h2>
            <p className="lede mt-4 max-w-xl text-cream/85">
              See the wall you mapped at true scale in a Meta Quest 2, with a digital climber moving through the route.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:mb-1">
            <span className="tag">Meta Quest 2</span>
            <span className="tag">In development</span>
          </div>
        </header>

        <div className="vr-grid">
          <div className="vr-art-card">
            <VrArt />
          </div>

          <ol className="vr-steps" role="list">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="vr-step">
                <span className="vr-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-extrabold leading-snug">
                    <Icon size={17} strokeWidth={2.6} aria-hidden="true" />
                    {title}
                  </p>
                  <p className="mt-0.5 text-[0.95rem] leading-snug text-ink/75">{body}</p>
                </div>
              </li>
            ))}
            <li className="vr-step-end" aria-hidden="true">
              <Sparkle size={18} /> <span className="pixel text-[0.62rem] text-cream/70">Summit reached</span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
