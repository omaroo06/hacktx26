interface LogoProps {
  /** "dark" for cream backgrounds, "light" for forest backgrounds. */
  tone?: "dark" | "light";
  className?: string;
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" fill="var(--color-forest)" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M7 38 L19 15 L25 25 L31 17 L42 38 Z" fill="var(--color-cream)" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M19 15 L22.5 21.5 L19.5 20 L16.5 21.8 Z" fill="var(--color-paper)" />
      <path d="M13.5 35 C 17 31, 24 33, 22 28 S 27 22, 30 21" fill="none" stroke="var(--color-coral)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="0.1 4" />
      <circle cx="13.5" cy="35" r="2.6" fill="var(--color-coral)" stroke="var(--color-ink)" strokeWidth="1.6" />
      <circle cx="30" cy="21" r="2.3" fill="var(--color-gold)" stroke="var(--color-ink)" strokeWidth="1.6" />
      <path d="M37 6.5 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3z" fill="var(--color-gold)" />
    </svg>
  );
}

/** Dotted route that swings under the wordmark and ends on a hold. */
function RouteSwash() {
  return (
    <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="logo-swash" aria-hidden="true">
      <path d="M3 9 C 22 15, 40 3, 58 9 S 84 12, 90 6" fill="none" stroke="var(--color-coral)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Logo({ tone = "dark", className = "" }: LogoProps) {
  return (
    <span className={`logo logo-${tone} ${className}`}>
      <LogoMark className="logo-mark" />
      <span className="logo-word brand" aria-label="beta">
        <span aria-hidden="true">beta</span>
        <span className="logo-hold" aria-hidden="true" />
        <RouteSwash />
      </span>
    </span>
  );
}
