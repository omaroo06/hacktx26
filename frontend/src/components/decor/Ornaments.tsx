import { useId, type CSSProperties } from "react";

interface SparkleProps {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  outlined?: boolean;
}

/** Four-point storybook star. */
export function Sparkle({ size = 20, color = "var(--color-gold)", className = "", style, outlined = true }: SparkleProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path
        d="M12 1.5 C 13 8, 16 11, 22.5 12 C 16 13, 13 16, 12 22.5 C 11 16, 8 13, 1.5 12 C 8 11, 11 8, 12 1.5 Z"
        fill={color}
        stroke={outlined ? "var(--color-ink)" : "none"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A chunky climbing-hold blob, reused for swatches and illustrations. */
export function HoldShape({
  fill,
  shade,
  className = "",
  variant = 0,
}: {
  fill: string;
  shade: string;
  className?: string;
  variant?: number;
}) {
  const shapes = [
    "M10 30 C 4 22, 9 9, 21 7 C 33 5, 42 13, 40 25 C 38 36, 27 42, 18 40 C 14 39, 12 34, 10 30 Z",
    "M8 24 C 7 13, 17 5, 27 7 C 38 9, 43 20, 38 30 C 33 39, 19 42, 12 36 C 9 33, 8 29, 8 24 Z",
    "M12 12 C 18 5, 33 5, 39 13 C 44 21, 39 34, 29 39 C 19 43, 7 37, 7 26 C 7 20, 9 15, 12 12 Z",
  ];
  const d = shapes[variant % shapes.length];
  const clipId = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <clipPath id={clipId}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={shade} />
      <g clipPath={`url(#${clipId})`}>
        <path d={d} fill={fill} transform="translate(-2 -3)" />
      </g>
      <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="24" cy="23" r="3.4" fill={shade} stroke="var(--color-ink)" strokeWidth="2" />
      <path d="M15 17 C 17 13, 21 11, 25 11" fill="none" stroke="rgb(255 255 255 / 0.65)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Mountain-ridge edge used to transition between page sections. */
export function RidgeDivider({ fill, flip = false, className = "" }: { fill: string; flip?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      className={`block w-full h-[46px] sm:h-[70px] ${className}`}
      style={flip ? { transform: "scaleY(-1)" } : undefined}
      aria-hidden="true"
    >
      <path
        d="M0 90 L0 58 L70 34 L132 52 L214 14 L292 50 L360 36 L436 62 L520 22 L598 48 L664 30 L742 60 L828 18 L902 46 L980 32 L1050 58 L1132 20 L1206 50 L1284 30 L1360 54 L1440 28 L1440 90 Z"
        fill={fill}
      />
      <path
        d="M0 58 L70 34 L132 52 L214 14 L292 50 L360 36 L436 62 L520 22 L598 48 L664 30 L742 60 L828 18 L902 46 L980 32 L1050 58 L1132 20 L1206 50 L1284 30 L1360 54 L1440 28"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}