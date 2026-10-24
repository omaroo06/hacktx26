import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "../brand/Logo";
import { useActiveSection } from "../../hooks/useActiveSection";

const LINKS = [
  { id: "top", label: "home" },
  { id: "wall", label: "climbing wall" },
  { id: "how", label: "how it works" },
] as const;

const SECTION_IDS = ["top", "wall", "how", "vr"] as const;

export function NavBar() {
  const active = useActiveSection(SECTION_IDS);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`nav-shell ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="nav-bar" aria-label="Main">
        <a href="#top" className="nav-logo" onClick={close} aria-label="beta, back to top">
          <Logo />
        </a>

        <ul className="nav-links" role="list">
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                className={`nav-link ${active === link.id ? "is-active" : ""}`}
                aria-current={active === link.id ? "location" : undefined}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a href="#wall" className="btn btn-gold btn-sm nav-cta">
            Start Climbing
            <ArrowRight size={18} strokeWidth={3} className="btn-arrow" />
          </a>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} strokeWidth={3} /> : <Menu size={22} strokeWidth={3} />}
          </button>
        </div>
      </nav>

      <div id="mobile-menu" className={`nav-mobile ${open ? "is-open" : ""}`} hidden={!open}>
        <ul role="list" className="flex flex-col gap-2">
          {LINKS.map((link, i) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                onClick={close}
                className={`nav-mobile-link ${active === link.id ? "is-active" : ""}`}
              >
                <span className="pixel text-xs opacity-60" aria-hidden="true">{`0${i + 1}`}</span>
                {link.label}
              </a>
            </li>
          ))}
          <li className="pt-2">
            <a href="#wall" onClick={close} className="btn btn-gold w-full">
              Start Climbing
              <ArrowRight size={20} strokeWidth={3} className="btn-arrow" />
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
