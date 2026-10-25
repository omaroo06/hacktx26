import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CircleAlert, MessageCircle, RotateCcw, SendHorizontal } from "lucide-react";
import type { ChatMessage, ClimberDossier, RouteContext } from "../../types/coach";
import { api } from "../../services/api";
import { useBetaSession } from "../../state/BetaSession";
import { RichText } from "./RichText";

interface CoachChatProps {
  dossiers: (ClimberDossier & { id: string })[];
  /** Everyone in the crew, analyzed or not, so anyone can ask. */
  names: { id: string; name: string }[];
  route: RouteContext | null;
  onSeek: (id: string, seconds: number) => void;
  blockedReason: string | null;
}

export function CoachChat({ dossiers, names, route, onSeek, blockedReason }: CoachChatProps) {
  const { setHighlightHold, routeHolds } = useBetaSession();
  const [speakerId, setSpeakerId] = useState(names[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const speaker = names.find((n) => n.id === speakerId) ?? names[0];
  const speakerDossier = dossiers.find((d) => d.id === speaker?.id);

  useEffect(() => {
    if (!names.some((n) => n.id === speakerId) && names[0]) setSpeakerId(names[0].id);
  }, [names, speakerId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const suggestions = speakerDossier
    ? [
        "What's the one thing I should fix first?",
        speakerDossier.report.outcome === "fell" ? "Why did I fall?" : "How do I make this climb feel easier?",
        dossiers.length > 1 ? "Who in my crew should I climb with next?" : "Give me a 20-minute warm-up for this route.",
      ]
    : ["How should I warm up for bouldering?", "What should I look for when I read a route?", "How do I film my climb so you can coach me?"];

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setDraft("");
    setPending(true);
    setError(null);
    try {
      const { reply } = await api.chat({
        speaker: speaker?.name ?? "Climber",
        messages: next,
        route,
        crew: dossiers.map(({ climber, report, feedback }) => ({ climber, report, feedback })),
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError((err as Error).message);
      setMessages(messages);
      setDraft(question);
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  const seekForSpeaker = speakerDossier ? (s: number) => onSeek(speakerDossier.id, s) : undefined;

  return (
    <section className="review-card chat-card" aria-labelledby="chat-title">
      <div className="review-card-head">
        <span className="review-icon" style={{ "--tint": "var(--color-mint)" } as CSSProperties}>
          <MessageCircle size={18} strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <p className="pixel text-[0.62rem] text-ink/60">Muse Spark · chat</p>
          <h3 id="chat-title" className="text-[1.75rem] leading-tight">
            ask your coach.
          </h3>
        </div>
        {messages.length > 0 && (
          <button type="button" className="icon-btn ml-auto" onClick={() => setMessages([])} aria-label="Start a new conversation" title="New conversation">
            <RotateCcw size={15} strokeWidth={3} />
          </button>
        )}
      </div>

      {names.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="field-label !mb-0">Chatting as</span>
          <div className="seg" role="group" aria-label="Who is asking">
            {names.map((n) => (
              <button key={n.id} type="button" aria-pressed={n.id === speaker?.id} onClick={() => setSpeakerId(n.id)}>
                {n.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={logRef} className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="display-text text-[1.2rem] leading-tight">
              {speakerDossier ? `I've watched your climb, ${speakerDossier.climber.name}.` : "Hi! I'm your beta coach."}
            </p>
            <p className="mt-1 text-[0.92rem] text-ink/70">
              {speakerDossier
                ? "Ask about any moment. I'll point you to the exact second in your video."
                : "Ask me anything about bouldering, or coach a clip above and I'll answer about your actual climb."}
            </p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="bubble bubble-user">
              {m.content}
            </div>
          ) : (
            <div key={i} className="bubble bubble-coach">
              <RichText text={m.content} onSeek={seekForSpeaker} onHold={routeHolds.length ? setHighlightHold : undefined} />
            </div>
          ),
        )}
        {pending && (
          <div className="bubble bubble-coach typing" aria-label="The coach is typing">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => void send(s)} disabled={pending || !!blockedReason}>
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="alert alert-sm mt-3" role="alert">
          <CircleAlert size={18} strokeWidth={2.6} className="mt-0.5 shrink-0" />
          <p className="flex-1 text-[0.9rem] font-bold">{error}</p>
        </div>
      )}

      <form className="chat-form" onSubmit={onSubmit}>
        <label htmlFor="coach-question" className="sr-only">
          Ask the coach
        </label>
        <input
          id="coach-question"
          className="field-input"
          placeholder={blockedReason ?? "Ask about a move, a hold, or your next session…"}
          value={draft}
          maxLength={600}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          disabled={!!blockedReason}
        />
        <button type="submit" className="btn btn-forest" disabled={pending || !draft.trim() || !!blockedReason} aria-label="Send">
          <SendHorizontal size={19} strokeWidth={2.8} />
        </button>
      </form>
    </section>
  );
}
