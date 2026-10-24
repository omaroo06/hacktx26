import { ArrowRight, Footprints, Glasses, PersonStanding, Ruler, ScanSearch, type LucideIcon } from "lucide-react";
import { Sparkle } from "../decor/Ornaments";

const INK = "var(--color-ink)";
const CREAM_LINE = "rgb(255 243 214 / 0.5)";

/** Wall panel corners in screen space (a gently receding plane). */
const WALL = { bl: [118, 300], br: [452, 300], tr: [418, 70], tl: [152, 70] } as const;

function lerp(a: readonly [number, number], b: readonly [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Maps a normalized wall position (u across, v up; origin bottom-left) to the screen. */
function wallPoint(u: number, v: number): [number, number] {
  const bottom = lerp(WALL.bl, WALL.br, u);
  const top = lerp(WALL.tl, WALL.tr, u);
  return lerp(bottom, top, v);
}

const HOLDS: [number, number][] = [
  [0.2, 0.08],
  [0.36, 0.26],
  [0.28, 0.46],
  [0.5, 0.6],
  [0.62, 0.8],
  [0.74, 0.95],
];

function WallScreen() {
  const vLines = [0.25, 0.5, 0.75].map((u) => [wallPoint(u, 0), wallPoint(u, 1)]);
  const hLines = [0.25, 0.5, 0.75].map((v) => [wallPoint(0, v), wallPoint(1, v)]);
  const route = HOLDS.map(([u, v]) => wallPoint(u, v));

  return (
    <svg viewBox="0 0 570 360" className="block h-auto w-full" role="img" aria-label="Illustration of a climbing wall rebuilt in VR, with X, Y and Z axes starting at the wall's bottom-left corner.">
      {/* Floor grid */}
      <g stroke="rgb(139 213 173 / 0.3)" strokeWidth="1.5">
        {Array.from({ length: 9 }, (_, i) => {
          const x = 285 + (i - 4) * 46;
          return <line key={`f${i}`} x1={x + (x - 285) * 0.9} y1="360" x2={x} y2="300" />;
        })}
        <line x1="0" y1="318" x2="570" y2="318" />
        <line x1="0" y1="340" x2="570" y2="340" />
      </g>

      {/* Wall */}
      <path
        d={`M${WALL.bl} L${WALL.br} L${WALL.tr} L${WALL.tl} Z`}
        fill="rgb(255 243 214 / 0.08)"
        stroke="var(--color-cream)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <g stroke={CREAM_LINE} strokeWidth="1.2" strokeDasharray="4 5">
        {[...vLines, ...hLines].map(([a, b], i) => (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
        ))}
      </g>

      <path
        d={`M${route.map((p) => p.join(" ")).join(" L")}`}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth="2.5"
        strokeDasharray="1 8"
        strokeLinecap="round"
        className="anim-march"
      />
      {route.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="8" fill="var(--color-coral)" stroke={INK} strokeWidth="2.5" />
          <circle cx={x} cy={y} r="13" fill="none" stroke="var(--color-coral)" strokeWidth="1.5" opacity="0.5" />
        </g>
      ))}

      {/* Axes from the wall's bottom-left origin */}
      <g strokeWidth="4" strokeLinecap="round">
        <line x1={WALL.bl[0]} y1={WALL.bl[1]} x2={WALL.bl[0] + 92} y2={WALL.bl[1]} stroke="var(--color-coral)" />
        <line x1={WALL.bl[0]} y1={WALL.bl[1]} x2={WALL.bl[0] + 13} y2={WALL.bl[1] - 88} stroke="var(--color-mint)" />
        <line x1={WALL.bl[0]} y1={WALL.bl[1]} x2={WALL.bl[0] - 46} y2={WALL.bl[1] + 40} stroke="var(--color-sky)" />
      </g>
      <g fontFamily="Silkscreen, monospace" fontSize="15">
        <text x={WALL.bl[0] + 100} y={WALL.bl[1] + 5} fill="var(--color-coral)">X</text>
        <text x={WALL.bl[0] + 8} y={WALL.bl[1] - 96} fill="var(--color-mint)">Y</text>
        <text x={WALL.bl[0] - 64} y={WALL.bl[1] + 54} fill="var(--color-sky)">Z</text>
        <text x={WALL.bl[0] + 12} y={WALL.bl[1] + 24} fill={CREAM_LINE} fontSize="11">0,0,0</text>
      </g>
      <circle cx={WALL.bl[0]} cy={WALL.bl[1]} r="5.5" fill="var(--color-cream)" stroke={INK} strokeWidth="2" />

      {/* Dimension marker */}
      <g stroke={CREAM_LINE} strokeWidth="1.5" fill="none">
        <path d={`M${WALL.br[0] + 22} ${WALL.br[1]} L${WALL.tr[0] + 22} ${WALL.tr[1]}`} />
        <path d={`M${WALL.br[0] + 15} ${WALL.br[1]} h14 M${WALL.tr[0] + 15} ${WALL.tr[1]} h14`} />
      </g>
      <text x={WALL.br[0] + 34} y="190" fontFamily="Silkscreen, monospace" fontSize="11" fill={CREAM_LINE}>
        H (m)
      </text>
    </svg>
  );
}

const CHAPTERS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ScanSearch, title: "discover your holds.", body: "Your route color picks out your line of holds from everything else on the wall." },
  { icon: Ruler, title: "map your wall.", body: "Real width and height turn photo pixels into meters, so every hold lands true." },
  { icon: Glasses, title: "bring your wall into vr.", body: "Unity rebuilds your wall, holds, and route inside Meta Quest 2." },
  { icon: Footprints, title: "find your beta.", body: "Move sequences shaped around your height, wingspan, and experience." },
  { icon: PersonStanding, title: "your digital twin.", body: "A 3D climber shows every move, built from real human motion." },
];

export function VrPreview() {
  return (
    <section id="vr" className="vr-section" aria-labelledby="vr-title">
      <div className="absolute inset-0 halftone opacity-40 [mask-image:linear-gradient(to_top,black,transparent_60%)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[var(--content-max)] items-start gap-12 px-[var(--space-gutter)] lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-28">
          <div className="crt">
            <div className="crt-hud">
              <span className="pixel">
                <span className="brand">beta</span> · VR
              </span>
              <span className="pixel flex items-center gap-2">
                <span className="hud-dot hud-dot-amber" /> Meta Quest 2
              </span>
            </div>
            <div className="crt-screen">
              <WallScreen />
              <div className="crt-scanlines" aria-hidden="true" />
              <span className="crt-stamp" aria-hidden="true">
                True scale
              </span>
            </div>
            <div className="crt-footer">
              <span className="pixel">Wall coordinates · meters</span>
              <span className="pixel">Origin · bottom-left</span>
            </div>
          </div>
        </div>

        <div>
          <p className="section-kicker text-forest">Chapter three · Virtual reality</p>
          <h2 id="vr-title" className="section-title mt-3 text-ink">
            step into <span className="title-stroke inline-block">your climb.</span>
          </h2>
          <p className="lede mt-5 text-ink/85">
            <span className="brand">beta</span> rebuilds your wall at true scale inside Meta Quest 2. With the wall’s real
            dimensions and every hold’s position, each hold sits exactly where it does in the gym, so you can rehearse a
            climb before you ever touch the rock.
          </p>

          <div className="coord-card mt-8">
            <p className="field-label !mb-3">How your wall is mapped</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-[0.95rem]">
              <dt className="axis-key bg-cream">Origin</dt>
              <dd>Bottom-left corner of the wall</dd>
              <dt className="axis-key bg-coral">X</dt>
              <dd>Across the wall, left to right</dd>
              <dt className="axis-key bg-mint">Y</dt>
              <dd>Up the wall</dd>
              <dt className="axis-key bg-sky">Z</dt>
              <dd>Out from the wall, toward the climber</dd>
              <dt className="axis-key bg-gold">Units</dt>
              <dd>Meters</dd>
            </dl>
          </div>

          <div className="mt-10">
            <h3 className="flex items-center gap-2 text-[1.75rem]">
              <Sparkle size={20} /> start to summit.
            </h3>
            <ol className="mt-4 flex flex-col gap-3" role="list">
              {CHAPTERS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="quest-item">
                  <span className="quest-item-num">
                    <Icon size={20} strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="pixel text-[0.6rem] text-ink/55">Chapter {`0${i + 1}`}</p>
                    <p className="display-text text-[1.22rem] leading-tight">{title}</p>
                    <p className="lede mt-0.5 text-[1rem] leading-snug text-ink/70">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <a href="#wall" className="btn btn-gold mt-6">
              Bring Your Wall Into VR
              <ArrowRight size={20} strokeWidth={3} className="btn-arrow" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
