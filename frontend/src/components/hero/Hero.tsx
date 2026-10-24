import type { CSSProperties } from "react";
import { ArrowRight, Map as MapIcon } from "lucide-react";
import { HeroScene } from "./HeroScene";
import { Sparkle } from "../decor/Ornaments";

function Cloud({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 110 56" className={className} style={style} aria-hidden="true">
      <path
        d="M20 50 C 4 50, 4 30, 22 30 C 24 12, 52 8, 60 26 C 68 12, 94 16, 92 36 C 106 36, 108 50, 94 50 Z"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M30 40 q 10 -6 20 0" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

const MARQUEE = ["Capture", "Discover", "Enter the World", "Every wall has a story", "Map your moves", "Step into VR"];

export function Hero() {
  return (
    <section id="top" className="relative px-[var(--space-gutter)] pt-28 sm:pt-32" aria-labelledby="hero-title">
      <div className="hero-frame mx-auto max-w-[var(--content-max)]">
        <div className="hero-sky" aria-hidden="true">
          <div className="absolute inset-0 halftone halftone-fade opacity-70" />
          <Cloud className="hero-cloud anim-drift hidden md:block" style={{ top: "11%", left: "4%", width: "clamp(70px, 10vw, 130px)" }} />
          <Cloud className="hero-cloud anim-drift hidden md:block" style={{ top: "24%", right: "5%", width: "clamp(60px, 8vw, 110px)", animationDelay: "-4s" }} />
          <Sparkle size={26} className="absolute anim-twinkle" style={{ top: "9%", left: "22%" }} />
          <Sparkle size={18} className="absolute anim-twinkle" style={{ top: "38%", left: "10%", animationDelay: "0.8s" }} />
          <Sparkle size={22} className="absolute anim-twinkle hidden sm:block" style={{ top: "14%", right: "20%", animationDelay: "1.6s" }} />
          <Sparkle size={14} className="absolute anim-twinkle" style={{ top: "44%", right: "14%", animationDelay: "0.4s" }} color="var(--color-paper)" />
        </div>

        <div className="hero-hud" aria-hidden="true">
          <span className="tag">World 01 · Indoor Bouldering</span>
          <span className="tag hidden sm:inline-flex">
            <span className="hud-dot" /> Player 1 · Ready
          </span>
        </div>

        <div className="relative z-10 flex flex-col items-center px-5 pt-16 text-center sm:pt-20">
          <p className="ribbon anim-pop-in">An enchanted climbing adventure</p>

          <h1 id="hero-title" className="hero-title anim-pop-in" style={{ animationDelay: "80ms" }}>
            <span className="block">every wall</span>
            <span className="block">
              has a <span className="title-stroke-gold">story.</span>
            </span>
          </h1>

          <p className="hero-lede anim-pop-in" style={{ animationDelay: "160ms" }}>
            Discover your route, map your moves, and bring your next climb into a new dimension.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 anim-pop-in" style={{ animationDelay: "240ms" }}>
            <a href="#wall" className="btn btn-gold btn-lg">
              Explore Your Wall
              <ArrowRight size={22} strokeWidth={3} className="btn-arrow" />
            </a>
            <a href="#how" className="btn btn-paper btn-lg">
              <MapIcon size={20} strokeWidth={2.6} />
              How It Works
            </a>
          </div>

          <p className="mt-6 flex items-center gap-2 pixel text-[0.72rem] text-ink/70" aria-hidden="true">
            <svg width="10" height="12" viewBox="0 0 10 12" className="anim-blink">
              <path d="M0 0 L10 6 L0 12 Z" fill="currentColor" />
            </svg>
            Press start to map your first wall
          </p>
        </div>

        <div className="hero-scene">
          <HeroScene />
        </div>
      </div>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="marquee-group">
              {MARQUEE.map((word) => (
                <span key={word} className="marquee-item">
                  {word}
                  <Sparkle size={18} color="var(--color-coral)" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
