import { Check } from "lucide-react";

export type QuestStep = "capture" | "route" | "coach";

const STEPS: { id: QuestStep; label: string }[] = [
  { id: "capture", label: "Capture" },
  { id: "route", label: "Choose route" },
  { id: "coach", label: "Get coached" },
];

export function QuestSteps({ current, hasPhoto }: { current: QuestStep; hasPhoto: boolean }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="quest-steps" aria-label="Workspace progress">
      {STEPS.map((step, i) => {
        const done = i < currentIndex || (step.id === "capture" && hasPhoto) || (step.id === "coach" && current === "coach");
        const isCurrent = i === currentIndex;
        return (
          <li
            key={step.id}
            className={`quest-step ${isCurrent ? "is-current" : ""} ${done ? "is-done" : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="quest-step-num">{done ? <Check size={15} strokeWidth={4} /> : `0${i + 1}`}</span>
            <span className="quest-step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
