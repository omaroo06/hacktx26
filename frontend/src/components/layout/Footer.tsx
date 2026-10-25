import { Logo } from "../brand/Logo";
import { RidgeDivider } from "../decor/Ornaments";

const LINKS = [
  { href: "#top", label: "home" },
  { href: "#wall", label: "climbing wall" },
  { href: "#coach", label: "coach" },
  { href: "#how", label: "how it works" },
  { href: "#vr", label: "vr preview" },
];

export function Footer() {
  return (
    <footer className="relative bg-forest-deep text-cream">
      <RidgeDivider fill="var(--color-forest-deep)" className="absolute bottom-full left-0 -mb-px" />
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-10 px-[var(--space-gutter)] pb-10 pt-14 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Logo tone="light" />
          <p className="lede mt-4 text-cream/75">
            Turning real bouldering walls into digital climbing worlds. One photo, one route, one story at a time.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-7 gap-y-3" role="list">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="footer-link">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t-2 border-dashed border-cream/15">
        <p className="mx-auto max-w-[var(--content-max)] px-[var(--space-gutter)] py-5 pixel text-[0.66rem] text-cream/50">
          <span className="brand">beta</span> · Every wall has a story · Photos and clips are analyzed by Gemini and Muse Spark
        </p>
      </div>
    </footer>
  );
}
