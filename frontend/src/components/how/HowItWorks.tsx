import type { CSSProperties, ReactNode } from "react";
import { Flag } from "lucide-react";
import { CaptureArt, CompassRose, DiscoverArt, EnterArt } from "./StageArt";
interface Stage {
  num: string;
  title: string;
  line: string;
  detail: string;
  art: ReactNode;
  tint: string;
  tilt: string;
}

const STAGES: Stage[] = [
  {
    num: "01",
    title: "capture.",
    line: "Take a picture of your climbing wall.",
    detail: "Any indoor bouldering wall works. One straight-on photo is all it takes to begin.",
    art: <CaptureArt />,
    tint: "var(--color-sky)",
    tilt: "-1.2deg",
  },
  {
    num: "02",
    title: "discover.",
    line: "Choose your route and map your holds.",
    detail: "Routes overlap on busy walls. Pick your hold color, then review and adjust every hold on your line.",
    art: <DiscoverArt />,
    tint: "var(--color-coral)",
    tilt: "0.8deg",
  },
  {
    num: "03",
    title: "enter the world.",
    line: "Step inside your climb in virtual reality.",
    detail: "Your wall is rebuilt at true scale in Meta Quest 2, every hold right where it belongs.",
    art: <EnterArt />,
    tint: "var(--color-mint)",
    tilt: "-0.6deg",
  },
];

/*
 * Drawn in a 1000×220 box laid over the top of the stop columns. Medallion
 * centers sit at x = 1/6, 1/2, 5/6 and y = 56, 156, 86 (see .trail-stop-n in
 * components.css); between stops the path drops through the card gutters.
 */
const TRAIL =
  "M-20 56 L166.7 56 C 290 56, 333 76, 333 108 C 333 142, 380 156, 500 156 C 600 156, 640 136, 666 116 C 700 92, 740 86, 833.3 86 C 920 86, 960 40, 1020 18";

export function HowItWorks() {
  return (
    <section id="how" className="how-section bg-grid" aria-labelledby="how-title">
      <div className="relative mx-auto max-w-[var(--content-max)] px-[var(--space-gutter)]">
        <header className="mx-auto max-w-2xl text-center">
          <p className="section-kicker text-coral">The trail map</p>
          <h2 id="how-title" className="section-title mt-3 text-forest">
            how <span className="brand">beta</span> works.
          </h2>
          <p className="lede mt-4 text-ink/75">
            Three stops between a photo on your phone and a wall you can step into. Follow the trail.
          </p>
        </header>

        <div className="trail-map panel parchment">
          <div className="absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
            <div className="absolute -left-10 -top-10 h-56 w-56 halftone opacity-50 [mask-image:radial-gradient(circle,black,transparent_70%)]" />
            <CompassRose className="absolute bottom-5 right-5 h-20 w-20 opacity-90 sm:h-24 sm:w-24" />
            <svg viewBox="0 0 120 40" className="absolute bottom-6 left-6 hidden w-28 opacity-40 lg:block">
              <path d="M2 38 L26 10 L40 26 L56 4 L84 38 Z" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M70 38 L92 16 L118 38" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
            </svg>
          </div>

          <svg viewBox="0 0 1000 220" preserveAspectRatio="none" className="trail-path" aria-hidden="true">
            <path d={TRAIL} fill="none" stroke="var(--color-sand)" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path
              d={TRAIL}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="2 12"
              vectorEffect="non-scaling-stroke"
              className="anim-march"
            />
          </svg>

          <span className="trail-start pixel" aria-hidden="true">
            Start here
          </span>
          <span className="trail-end pixel" aria-hidden="true">
            <Flag size={14} strokeWidth={3} className="text-coral" />
            Summit
          </span>
          <ol className="trail-stops" role="list">
            {STAGES.map((s, i) => (
              <li key={s.num} className={`trail-stop trail-stop-${i + 1}`}>
                <span className="trail-medallion" aria-hidden="true">
                  {s.num}
                </span>
                <article className="stop-card" style={{ "--tint": s.tint, "--tilt": s.tilt } as CSSProperties}>
                  <div className="stop-art">{s.art}</div>
                  <div className="p-5 pt-4">
                    <p className="pixel text-[0.7rem] text-ink/60">Stop {s.num}</p>
                    <h3 className="mt-1 text-[1.75rem] text-forest">{s.title}</h3>
                    <p className="display-text mt-2 text-[1.14rem] leading-snug">{s.line}</p>
                    <p className="lede mt-2 text-[1.02rem] leading-normal text-ink/70">{s.detail}</p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
