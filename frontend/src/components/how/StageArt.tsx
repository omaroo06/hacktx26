const INK = "var(--color-ink)";

export function CaptureArt() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
      <path d="M0 130 L0 92 L40 70 L70 86 L110 52 L150 80 L200 60 L200 130 Z" fill="var(--color-sky-deep)" opacity="0.35" />
      <g transform="rotate(-8 100 66)">
        <rect x="62" y="12" width="76" height="112" rx="13" fill="var(--color-ink)" />
        <rect x="68" y="22" width="64" height="88" rx="5" fill="var(--color-sand)" />
        <g stroke={INK} strokeWidth="2">
          <ellipse cx="84" cy="96" rx="5" ry="4" fill="var(--color-coral)" />
          <ellipse cx="104" cy="80" rx="5" ry="4" fill="var(--color-coral)" />
          <ellipse cx="90" cy="60" rx="4.5" ry="3.5" fill="var(--color-coral)" />
          <ellipse cx="114" cy="44" rx="5" ry="4" fill="var(--color-coral)" />
          <ellipse cx="118" cy="90" rx="4" ry="3" fill="var(--color-lavender)" />
          <ellipse cx="78" cy="38" rx="4" ry="3" fill="var(--color-mint)" />
        </g>
        <g stroke="var(--color-paper)" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M72 34 v-8 h8" />
          <path d="M128 34 v-8 h-8" />
          <path d="M72 98 v8 h8" />
          <path d="M128 98 v8 h-8" />
        </g>
        <rect x="88" y="15" width="24" height="3.5" rx="1.75" fill="#3a443a" />
      </g>
      <path className="anim-twinkle" d="M156 22 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="var(--color-gold)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path className="anim-twinkle" style={{ animationDelay: "1s" }} d="M38 36 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="var(--color-paper)" stroke={INK} strokeWidth="1.8" />
    </svg>
  );
}

export function DiscoverArt() {
  const route = [
    [56, 108],
    [84, 84],
    [70, 58],
    [104, 42],
    [128, 18],
  ];
  return (
    <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
      <path d="M36 130 L48 14 Q50 6 58 6 L146 6 Q154 6 156 14 L168 130 Z" fill="var(--color-sand)" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g stroke={INK} strokeWidth="2">
        <ellipse cx="128" cy="96" rx="6" ry="4.5" fill="var(--color-sky)" />
        <ellipse cx="146" cy="60" rx="5" ry="4" fill="var(--color-mint)" />
        <ellipse cx="60" cy="30" rx="5" ry="4" fill="var(--color-sky)" />
        <ellipse cx="112" cy="68" rx="4.5" ry="3.5" fill="var(--color-mint)" />
        <ellipse cx="140" cy="116" rx="5" ry="4" fill="var(--color-lavender)" />
      </g>
      <path
        d={`M${route.map(([x, y]) => `${x} ${y}`).join(" L")}`}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 8"
        className="anim-march"
      />
      {route.map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="7.5" ry="6" fill="var(--color-gold)" stroke={INK} strokeWidth="2.5" />
          <circle cx={x} cy={y} r="1.8" fill={INK} />
        </g>
      ))}
      <ellipse cx="104" cy="42" rx="15" ry="13" fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeDasharray="5 4" transform="rotate(-12 104 42)" />
    </svg>
  );
}

export function CoachArt() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
      <path d="M0 130 L0 100 L46 80 L84 96 L126 70 L170 92 L200 82 L200 130 Z" fill="var(--color-forest)" opacity="0.18" />
      {/* Video of the climb */}
      <g transform="rotate(-4 78 62)">
        <rect x="22" y="14" width="112" height="90" rx="11" fill="var(--color-ink)" />
        <rect x="29" y="22" width="98" height="62" rx="5" fill="var(--color-sand)" />
        <g stroke={INK} strokeWidth="1.8">
          <ellipse cx="58" cy="34" rx="4" ry="3" fill="var(--color-coral)" />
          <ellipse cx="96" cy="40" rx="4" ry="3" fill="var(--color-coral)" />
          <ellipse cx="54" cy="74" rx="4" ry="3" fill="var(--color-coral)" />
          <ellipse cx="90" cy="76" rx="4" ry="3" fill="var(--color-coral)" />
          <ellipse cx="112" cy="62" rx="3.5" ry="2.5" fill="var(--color-sky)" />
        </g>
        <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M74 52 L74 64" />
          <path d="M74 52 L60 36" />
          <path d="M74 52 L94 42" />
          <path d="M74 64 L57 73" />
          <path d="M74 64 L88 74" />
        </g>
        <circle cx="74" cy="46" r="5" fill="var(--color-paper)" stroke={INK} strokeWidth="2.5" />
        <rect x="29" y="91" width="98" height="5" rx="2.5" fill="#3a443a" />
        <rect x="29" y="91" width="52" height="5" rx="2.5" fill="var(--color-sky)" />
        <rect x="44" y="89" width="4" height="9" rx="1.5" fill="var(--color-mint)" stroke={INK} strokeWidth="1.2" />
        <rect x="70" y="89" width="4" height="9" rx="1.5" fill="var(--color-coral)" stroke={INK} strokeWidth="1.2" />
        <rect x="104" y="89" width="4" height="9" rx="1.5" fill="var(--color-mint)" stroke={INK} strokeWidth="1.2" />
      </g>
      {/* Coach's note */}
      <path
        d="M128 46 H182 Q190 46 190 54 V88 Q190 96 182 96 H146 L134 106 L136 96 H128 Q120 96 120 88 V54 Q120 46 128 46 Z"
        fill="var(--color-paper)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="134" cy="61" r="6" fill="var(--color-mint)" stroke={INK} strokeWidth="2" />
      <path d="M131 61 l2.2 2.4 4 -4.6" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="145" y="58" width="36" height="5" rx="2.5" fill={INK} opacity="0.75" />
      <rect x="128" y="72" width="53" height="4.5" rx="2.25" fill={INK} opacity="0.35" />
      <rect x="128" y="82" width="38" height="4.5" rx="2.25" fill={INK} opacity="0.35" />
      <path className="anim-twinkle" d="M176 14 l3.5 8.5 8.5 3.5 -8.5 3.5 -3.5 8.5 -3.5 -8.5 -8.5 -3.5 8.5 -3.5z" fill="var(--color-gold)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path className="anim-twinkle" style={{ animationDelay: "0.9s" }} d="M150 22 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="var(--color-paper)" stroke={INK} strokeWidth="1.8" />
    </svg>
  );
}

export function VrArt() {
  return (
    <svg viewBox="0 0 200 130" className="h-full w-full" aria-hidden="true">
      <path d="M20 60 C 20 30, 180 30, 180 60" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <rect x="28" y="46" width="144" height="66" rx="24" fill="var(--color-paper)" stroke={INK} strokeWidth="3.5" />
      <rect x="40" y="56" width="120" height="46" rx="16" fill="var(--color-forest)" stroke={INK} strokeWidth="3" />
      <clipPath id="vr-visor-clip">
        <rect x="40" y="56" width="120" height="46" rx="16" />
      </clipPath>
      <g clipPath="url(#vr-visor-clip)">
        <path d="M40 102 L70 74 L88 88 L112 64 L160 102 Z" fill="var(--color-mint)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M112 64 L120 72 L112 70 L105 72 Z" fill="var(--color-paper)" />
        <circle cx="64" cy="68" r="5" fill="var(--color-gold)" />
        <g stroke="rgb(255 243 214 / 0.25)" strokeWidth="1">
          <path d="M40 92 H160" />
          <path d="M40 82 H160" />
        </g>
      </g>
      <path d="M86 112 Q100 100 114 112" fill="var(--color-cream)" stroke={INK} strokeWidth="3" />
      <path d="M48 62 q 10 -4 20 -2" fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="3" strokeLinecap="round" />
      <path className="anim-twinkle" d="M172 16 l3.5 8.5 8.5 3.5 -8.5 3.5 -3.5 8.5 -3.5 -8.5 -8.5 -3.5 8.5 -3.5z" fill="var(--color-gold)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path className="anim-twinkle" style={{ animationDelay: "0.9s" }} d="M24 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="var(--color-paper)" stroke={INK} strokeWidth="1.8" />
    </svg>
  );
}

export function CompassRose({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill="var(--color-paper)" stroke={INK} strokeWidth="3" />
      <circle cx="50" cy="50" r="27" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="2 4" />
      <path d="M50 10 L58 50 L50 90 L42 50 Z" fill="var(--color-cream)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M50 10 L58 50 L42 50 Z" fill="var(--color-coral)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 50 L50 44 L90 50 L50 56 Z" fill="var(--color-sand)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="4" fill={INK} />
      <text x="50" y="7" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="10" fill={INK}>
        N
      </text>
    </svg>
  );
}
