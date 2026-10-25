import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Flag } from "lucide-react";
import { CaptureArt, CoachArt, CompassRose, DiscoverArt, VrArt } from "./StageArt";
interface Stage {
  num: string;
  title: string;
  line: string;
  detail: string;
  art: ReactNode;
  tint: string;
  tilt: string;
  /** Makes the whole card a link to another part of the page. */
  href?: string;
  cta?: string;
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
    title: "get coached.",
    line: "Film your climb and get AI coaching.",
    detail: "Gemini watches every move. Muse Spark tells you what worked, what to fix, and who in your crew can show you how.",
    art: <CoachArt />,
    tint: "var(--color-mint)",
    tilt: "-0.6deg",
  },
  {
    num: "04",
    title: "enter VR.",
    line: "See your wall in Meta Quest 2.",
    detail: "Your wall rebuilt at true scale in the headset, every hold where it belongs.",
    art: <VrArt />,
    tint: "var(--color-lavender)",
    tilt: "0.9deg",
    href: "#vr",
    cta: "See the steps",
  },
];

/*
 * Drawn in a 1000×220 box laid over the top of the stop columns. Medallion
 * centers sit at x = 1/8, 3/8, 5/8, 7/8 and y = 56, 146, 76, 136 (see
 * .trail-stop-n in components.css); between stops the path runs through the gutters.
 */
const TRAIL =
  "M-20 56 L125 56 C 200 56, 250 70, 250 100 C 250 132, 290 146, 375 146 C 450 146, 480 120, 500 100 C 520 82, 560 76, 625 76 C 700 76, 730 96, 750 116 C 770 134, 810 136, 875 136 C 940 136, 970 70, 1020 18";

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
            Four stops between a photo on your phone and a wall you can step into. Follow the trail.
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
                {(() => {
                  const body = (
                    <>
                      <div className="stop-art">{s.art}</div>
                      <div className="p-5 pt-4">
                        <p className="pixel text-[0.7rem] text-ink/60">Stop {s.num}</p>
                        <h3 className="mt-1 text-[1.75rem] text-forest">{s.title}</h3>
                        <p className="display-text mt-2 text-[1.14rem] leading-snug">{s.line}</p>
                        <p className="lede mt-2 text-[1.02rem] leading-normal text-ink/70">{s.detail}</p>
                        {s.cta && (
                          <span className="stop-cta">
                            {s.cta}
                            <ArrowRight size={16} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </>
                  );
                  const style = { "--tint": s.tint, "--tilt": s.tilt } as CSSProperties;
                  return s.href ? (
                    <a href={s.href} className="stop-card is-link" style={style}>
                      {body}
                    </a>
                  ) : (
                    <article className="stop-card" style={style}>
                      {body}
                    </article>
                  );
                })()}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
