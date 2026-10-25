const INK = "var(--color-ink)";

const ROUTE_PATH =
  "M548 412 C 520 384, 516 352, 554 332 C 590 314, 600 292, 572 264 C 548 240, 560 212, 592 198 C 622 184, 620 162, 598 142 C 584 128, 592 114, 600 102";

const ROUTE_HOLDS = [
  { x: 528, y: 372, fill: "var(--color-coral)", rx: 12, ry: 9 },
  { x: 578, y: 318, fill: "var(--color-sky)", rx: 11, ry: 9 },
  { x: 556, y: 258, fill: "var(--color-gold)", rx: 12, ry: 10 },
  { x: 594, y: 202, fill: "var(--color-mint)", rx: 10, ry: 8 },
  { x: 612, y: 152, fill: "var(--color-lavender)", rx: 9, ry: 7 },
];

const SCATTER_HOLDS = [
  { x: 488, y: 330, fill: "var(--color-lavender)" },
  { x: 646, y: 246, fill: "var(--color-coral)" },
  { x: 690, y: 330, fill: "var(--color-sky)" },
  { x: 520, y: 222, fill: "var(--color-mint)" },
  { x: 654, y: 380, fill: "var(--color-gold)" },
  { x: 628, y: 300, fill: "var(--color-paper)" },
];

function Pine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="-6" width="8" height="18" fill="#6b4a2f" stroke={INK} strokeWidth="2.5" />
      <path d="M0 -62 L22 -24 L12 -24 L28 -2 L-28 -2 L-12 -24 L-22 -24 Z" fill="var(--color-moss)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M0 -62 L8 -48 L0 -44 Z" fill="var(--color-mint)" opacity="0.7" />
    </g>
  );
}

export function HeroScene() {
  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMax slice"
      className="block h-full w-full"
      role="img"
      aria-label="Illustration of an enchanted mountain with a dotted climbing route of colorful holds leading to a flag at the summit."
    >
      {/* Sun and rays */}
      <g opacity="0.55">
        {Array.from({ length: 14 }, (_, i) => {
          const a0 = (Math.PI * (i * 2)) / 28 + Math.PI;
          const a1 = a0 + Math.PI / 28;
          const r = 900;
          return (
            <path
              key={i}
              d={`M600 210 L${600 + r * Math.cos(a0)} ${210 + r * Math.sin(a0)} L${600 + r * Math.cos(a1)} ${210 + r * Math.sin(a1)} Z`}
              fill="var(--color-gold)"
              opacity="0.45"
            />
          );
        })}
      </g>
      <circle cx="600" cy="200" r="128" fill="var(--color-gold)" stroke={INK} strokeWidth="3" />
      <circle cx="600" cy="200" r="104" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" opacity="0.5" />

      {/* Far range */}
      <path
        d="M-10 300 L60 242 L120 272 L200 186 L270 250 L330 216 L400 268 L470 300 L730 300 L790 258 L852 204 L920 252 L990 212 L1060 156 L1130 232 L1210 202 L1210 420 L-10 420 Z"
        fill="var(--color-lavender-soft)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M200 186 L222 210 L210 206 L200 214 L190 205 L178 210 Z" fill="var(--color-paper)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M1060 156 L1084 184 L1071 179 L1060 188 L1049 178 L1036 184 Z" fill="var(--color-paper)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />

      {/* Mid hills */}
      <path
        d="M-10 342 C 80 302, 160 292, 250 322 S 400 302, 470 332 L 760 332 C 820 302, 920 292, 1000 316 S 1150 302, 1210 322 L1210 420 L-10 420 Z"
        fill="var(--color-mint)"
        stroke={INK}
        strokeWidth="3"
      />
      <g fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.35">
        <path d="M120 330 q 14 -8 28 0" />
        <path d="M900 318 q 14 -8 28 0" />
        <path d="M1060 330 q 10 -6 20 0" />
      </g>

      {/* The wall-mountain */}
      <path
        d="M420 420 L452 330 L478 300 L500 240 L528 200 L548 140 L574 92 L600 46 L628 88 L650 128 L676 170 L700 230 L726 268 L752 320 L790 420 Z"
        fill="var(--color-sand)"
      />
      <path
        d="M600 46 L628 88 L650 128 L676 170 L700 230 L726 268 L752 320 L790 420 L655 420 L640 330 L662 250 L632 162 L614 100 Z"
        fill="#d4b27a"
      />
      <path
        d="M420 420 L452 330 L478 300 L500 240 L528 200 L548 140 L574 92 L600 46 L628 88 L650 128 L676 170 L700 230 L726 268 L752 320 L790 420"
        fill="none"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M574 92 L600 46 L628 88 L614 82 L604 96 L592 84 Z" fill="var(--color-paper)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity="0.4">
        <path d="M470 372 L506 364" />
        <path d="M700 296 L726 292" />
        <path d="M512 290 L536 286" />
        <path d="M664 196 L684 192" />
        <path d="M720 372 L748 368" />
      </g>

      {/* Decorative holds */}
      {SCATTER_HOLDS.map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y})`} opacity="0.85">
          <ellipse rx="7" ry="5.5" fill={h.fill} stroke={INK} strokeWidth="2.5" />
        </g>
      ))}

      {/* Route */}
      <path d={ROUTE_PATH} fill="none" stroke="var(--color-paper)" strokeWidth="9" strokeLinecap="round" opacity="0.7" />
      <path
        d={ROUTE_PATH}
        fill="none"
        stroke={INK}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray="1 12"
        className="anim-march"
      />
      {ROUTE_HOLDS.map((h, i) => (
        <g key={i} transform={`translate(${h.x} ${h.y})`}>
          <ellipse rx={h.rx} ry={h.ry} fill={h.fill} stroke={INK} strokeWidth="3" />
          <circle r="2.4" fill={INK} />
          <path d={`M${-h.rx * 0.55} ${-h.ry * 0.35} q ${h.rx * 0.3} ${-h.ry * 0.45} ${h.rx * 0.7} ${-h.ry * 0.4}`} stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
      ))}

      {/* Summit flag */}
      <line x1="600" y1="48" x2="600" y2="6" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <g className="hero-flag">
        <path d="M601 8 L642 17 L601 30 Z" fill="var(--color-coral)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </g>

      {/* Foreground */}
      <path
        d="M-10 378 C 120 350, 260 358, 380 384 C 430 394, 470 402, 520 406 L 690 406 C 770 396, 870 360, 990 362 C 1090 364, 1150 374, 1210 370 L1210 420 L-10 420 Z"
        fill="var(--color-forest)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <Pine x={78} y={374} s={1.05} />
      <Pine x={136} y={384} s={0.8} />
      <Pine x={1044} y={372} s={1} />
      <Pine x={1100} y={382} s={0.78} />
      <Pine x={1166} y={378} s={0.92} />

      {/* Trail sign */}
      <g transform="translate(296 336)">
        <rect x="-4" y="0" width="8" height="64" fill="#7a5536" stroke={INK} strokeWidth="2.5" />
        <path d="M-46 -6 L36 -6 L54 10 L36 26 L-46 26 Z" fill="var(--color-cream)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <text x="-4" y="15" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="13" fill={INK}>
          WALL 01
        </text>
      </g>

      {/* Ground sparkles */}
      <g fill="var(--color-gold)" stroke={INK} strokeWidth="1.5">
        <path className="anim-twinkle" d="M880 392 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        <path className="anim-twinkle" style={{ animationDelay: "1.2s" }} d="M210 398 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4z" />
      </g>
    </svg>
  );
}
