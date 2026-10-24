import { ArrowLeft, Check, Flag, ScanSearch } from "lucide-react";
import type { HoldColorId, RouteSelection } from "../../types/wall";
import { HOLD_COLORS, QUICK_GRADES, getHoldColor } from "../../lib/holdColors";
import { HoldShape } from "../decor/Ornaments";

interface RouteSelectorProps {
  route: RouteSelection;
  onChange: (patch: Partial<RouteSelection>) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function RouteSelector({ route, onChange, onBack, onConfirm }: RouteSelectorProps) {
  const selected = route.color ? getHoldColor(route.color) : null;
  const grade = route.grade.trim().toUpperCase();

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (route.color) onConfirm();
      }}
    >
      <fieldset>
        <legend className="sr-only">Hold color</legend>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="field-label !mb-0" aria-hidden="true">
            Hold color
          </span>
          <span className="text-[0.85rem] font-extrabold text-forest" aria-live="polite">
            {selected ? `${selected.label} selected` : "Choose one"}
          </span>
        </div>
        <p className="-mt-0.5 mb-3 text-[0.95rem] text-ink/70">
          Which colored holds make up the route you want to climb?
        </p>
        <div className="swatch-grid">
          {HOLD_COLORS.map((c, i) => {
            const isSelected = route.color === c.id;
            return (
              <label key={c.id} className={`swatch ${isSelected ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="hold-color"
                  value={c.id}
                  checked={isSelected}
                  onChange={() => onChange({ color: c.id as HoldColorId })}
                  className="sr-only"
                />
                <span className="swatch-marker" aria-hidden="true">
                  <svg viewBox="0 0 14 10" width="14" height="10">
                    <path d="M1 1 L13 1 L7 9 Z" fill="var(--color-ink)" />
                  </svg>
                </span>
                <HoldShape fill={c.fill} shade={c.shade} variant={i} className="swatch-hold" />
                <span className="swatch-label">{c.label}</span>
                {isSelected && (
                  <span className="swatch-check" aria-hidden="true">
                    <Check size={12} strokeWidth={4} />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="route-name" className="field-label">
          Route name <span className="opacity-55">· optional</span>
        </label>
        <input
          id="route-name"
          className="field-input"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder={selected ? `e.g. The ${selected.label} Staircase` : "e.g. Mossy Arête"}
          value={route.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="route-grade" className="field-label">
          Grade <span className="opacity-55">· optional</span>
        </label>
        <input
          id="route-grade"
          className="field-input max-w-[12rem]"
          type="text"
          maxLength={12}
          autoComplete="off"
          placeholder="e.g. V2"
          value={route.grade}
          onChange={(e) => onChange({ grade: e.target.value })}
          aria-describedby="grade-hint"
        />
        <p id="grade-hint" className="sr-only">
          Type any grade, or use the quick picks below.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Quick grade picks">
          {QUICK_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className={`grade-chip ${grade === g ? "is-selected" : ""}`}
              aria-pressed={grade === g}
              onClick={() => onChange({ grade: grade === g ? "" : g })}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="notice" role="note">
        <ScanSearch size={22} strokeWidth={2.4} className="mt-0.5 shrink-0" />
        <div>
          <p className="display-text text-[1.2rem] leading-tight">discover your holds.</p>
          <p className="mt-1 text-[0.93rem] text-ink/75">
            Routes share the wall, so your hold color tells <span className="brand">beta</span> which climb is yours.
            Every hold in that color belongs to your route, ready to review, adjust, and carry into VR.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t-[3px] border-dashed border-ink/20 pt-6">
        <button type="button" className="link-btn" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={2.8} />
          Back to photo
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <button type="submit" className="btn btn-coral" disabled={!route.color}>
            <Flag size={18} strokeWidth={2.8} />
            Set this route
          </button>
          {!route.color && <p className="pixel text-[0.64rem] text-ink/60">Pick a hold color first</p>}
        </div>
      </div>
    </form>
  );
}
