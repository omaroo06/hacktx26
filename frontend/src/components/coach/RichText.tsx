import { Fragment, type ReactNode } from "react";

export interface RichTextActions {
  /** Jump the video to a moment. */
  onSeek?: (seconds: number) => void;
  /** Light up a numbered hold on the wall (null to clear). */
  onHold?: (n: number | null) => void;
}

const TOKEN = /(\*\*[^*]+\*\*)|(\b\d{1,2}:\d{2}\b)|(\bhold\s*#?\d{1,2}\b)/gi;

function toSeconds(t: string): number {
  const [m, s] = t.split(":").map(Number);
  return m * 60 + s;
}

/** Turns "0:12" into a seek button and "hold 4" into a hold highlight, inline. */
export function inline(text: string, actions: RichTextActions, keyPrefix = "t"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, bold, time, hold] = match;
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (bold) {
      out.push(<strong key={key}>{inline(bold.slice(2, -2), actions, key)}</strong>);
    } else if (time) {
      out.push(
        actions.onSeek ? (
          <TimeChip key={key} t={time} onSeek={actions.onSeek} />
        ) : (
          <span key={key} className="time-chip is-static">
            {time}
          </span>
        ),
      );
    } else if (hold) {
      const n = Number(hold.match(/\d+/)?.[0]);
      out.push(
        <span
          key={key}
          className="hold-ref"
          onMouseEnter={() => actions.onHold?.(n)}
          onMouseLeave={() => actions.onHold?.(null)}
          onFocus={() => actions.onHold?.(n)}
          onBlur={() => actions.onHold?.(null)}
          tabIndex={actions.onHold ? 0 : undefined}
        >
          {whole}
        </span>,
      );
    }
    last = start + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function TimeChip({ t, onSeek, label }: { t: string; onSeek: (s: number) => void; label?: string }) {
  return (
    <button type="button" className="time-chip" onClick={() => onSeek(toSeconds(t))} aria-label={label ?? `Jump to ${t} in the video`}>
      {t}
    </button>
  );
}

/** A small, safe Markdown subset for coach replies: paragraphs, bullet and numbered lists, bold. */
export function RichText({ text, ...actions }: { text: string } & RichTextActions) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d+[.)]/.test(lines[0]);
          const items = lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), actions, `b${b}l${j}`)}</li>);
          return ordered ? (
            <ol key={b} className="rich-list is-ordered">
              {items}
            </ol>
          ) : (
            <ul key={b} className="rich-list">
              {items}
            </ul>
          );
        }
        return (
          <p key={b}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""), actions, `b${b}p${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
