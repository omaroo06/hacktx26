import { ArrowRight, Eye, Pencil, RotateCcw, Sparkles, Users } from "lucide-react";
import type { RouteSelection } from "../../types/wall";
import { getHoldColor } from "../../lib/holdColors";
import { HoldShape, Sparkle } from "../decor/Ornaments";
import { useBetaSession } from "../../state/BetaSession";

interface CoachStepProps {
  route: RouteSelection;
  onEdit: () => void;
  onStartOver: () => void;
}

const PERKS = [
  { icon: Eye, text: "Gemini watches your clip and maps every move to your numbered holds." },
  { icon: Sparkles, text: "Muse Spark tells you what worked, what to fix, and a drill for each." },
  { icon: Users, text: "Add friends' clips and the coach shows who can teach whom." },
];

/** Step 03 of the wall workspace: the route is set, so send the climber to AI coaching. */
export function CoachStep({ route, onEdit, onStartOver }: CoachStepProps) {
  const { routeHolds, detection } = useBetaSession();
  if (!route.color) return null;
  const color = getHoldColor(route.color);
  const name = route.name.trim() || `${color.label} route`;
  const grade = route.grade.trim();

  return (
    <div className="flex flex-col gap-6 anim-pop-in">
      <div className="ticket" style={{ background: color.fill, color: color.onFill }}>
        <div className="ticket-stub" aria-hidden="true">
          <HoldShape fill={color.fill} shade={color.shade} className="h-14 w-14" />
        </div>
        <div className="min-w-0 flex-1 p-5">
          <p className="pixel text-[0.68rem] opacity-80">Your route · {color.label} holds</p>
          <h3 className="mt-1.5 break-words text-[clamp(1.6rem,2.6vw,2.2rem)]">{name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {grade && <span className="tag">{grade}</span>}
            <span className="tag">
              {routeHolds.length
                ? `${routeHolds.length} holds numbered`
                : detection.status === "loading"
                  ? "Mapping holds…"
                  : "Holds not mapped"}
            </span>
          </div>
        </div>
        <Sparkle size={22} className="absolute right-4 top-4 anim-twinkle" color="var(--color-paper)" />
      </div>

      <ul className="flex flex-col gap-3.5" role="list">
        {PERKS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex gap-3">
            <span className="tip-icon">
              <Icon size={17} strokeWidth={2.6} />
            </span>
            <span className="text-[0.95rem] leading-snug text-ink/80">{text}</span>
          </li>
        ))}
      </ul>

      <a href="#coach" className="btn btn-gold w-full">
        Get AI coaching
        <ArrowRight size={20} strokeWidth={3} className="btn-arrow" />
      </a>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t-[3px] border-dashed border-ink/20 pt-6">
        <button type="button" className="link-btn" onClick={onStartOver}>
          <RotateCcw size={17} strokeWidth={2.8} />
          Start a new wall
        </button>
        <button type="button" className="btn btn-paper btn-sm" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2.8} />
          Edit route
        </button>
      </div>
    </div>
  );
}
