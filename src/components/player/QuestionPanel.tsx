"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useFocusGuard, type FocusEventKind } from "@/hooks/useFocusGuard";
import { friendlyError } from "@/lib/errors";
import type { MyAttempt } from "@/lib/game/types";
import { secondsLeft } from "@/lib/player/countdown";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Props = {
  attempt: MyAttempt & { question: NonNullable<MyAttempt["question"]> };
  offsetMs: number;
  player: { name: string; usn: string };
  timerSeconds: number;
  onSubmitted: () => void;
};

function Watermark({ text }: { text: string }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 grid -rotate-[18deg] grid-cols-2 content-around overflow-hidden text-lg font-bold text-text/[0.05]">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i}>{text}</span>
      ))}
    </div>
  );
}

export function QuestionPanel({ attempt, offsetMs, player, timerSeconds, onSubmitted }: Props) {
  const { question } = attempt;
  // Code questions put the prompt on the first line and the snippet after it; keep its line breaks and indents.
  const [prompt, ...codeLines] = question.text.split("\n");
  const code = codeLines.join("\n");
  const [choice, setChoice] = useState<string>("");
  const [left, setLeft] = useState(() => secondsLeft(attempt.deadline, Date.now(), offsetMs));
  const [state, setState] = useState<"answering" | "sending" | "sent" | "timeout">("answering");
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  const report = (kind: FocusEventKind, awayMs?: number) => {
    void getBrowserSupabase().rpc("report_focus_event", { p_attempt_id: attempt.id, p_kind: kind, p_away_ms: awayMs ?? null });
  };
  const guard = useFocusGuard({ active: state === "answering", onReport: report });

  const submit = async (answer: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setState("sending");
    const { error: err } = await getBrowserSupabase().rpc("submit_answer", { p_attempt_id: attempt.id, p_answer: answer });
    if (err && err.message !== "ALREADY_ANSWERED") {
      submitted.current = false;
      setState("answering");
      setError(friendlyError(err.message));
      return;
    }
    navigator.vibrate?.(40);
    setState("sent");
    onSubmitted();
  };

  // Countdown from the server deadline; at zero, send whatever is chosen.
  const latestChoice = useRef(choice);
  latestChoice.current = choice;
  useEffect(() => {
    const tick = setInterval(() => {
      const s = secondsLeft(attempt.deadline, Date.now(), offsetMs);
      setLeft(s);
      if (s === 0 && !submitted.current) {
        clearInterval(tick);
        if (latestChoice.current.trim()) void submit(latestChoice.current);
        else {
          setState("timeout");
          setTimeout(onSubmitted, 2500);
        }
      }
    }, 250);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id, attempt.deadline, offsetMs]);

  const pct = Math.max(0, Math.min(100, (left / Math.max(1, timerSeconds)) * 100));
  const urgent = left <= 5;

  return (
    <section
      className="relative flex w-full max-w-xl select-none flex-col gap-5 [-webkit-touch-callout:none]"
      // Fullscreen needs a tap; the first touch on the question keeps the player inside the game. Not all phones support it.
      onPointerDownCapture={() => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      }}
    >
      <Watermark text={`${player.name} · ${player.usn}`} />
      <div className="relative z-10 flex items-center justify-between">
        <p className="text-xs tracking-[0.12em] text-muted uppercase">Chair {String(attempt.chairNumber).padStart(2, "0")}</p>
        <p className={`font-mono text-4xl tabular-nums ${urgent ? "text-red" : "text-amber"}`} aria-live={left === 10 || left === 5 ? "polite" : "off"}>
          00:{String(left).padStart(2, "0")}
        </p>
      </div>
      <div role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={timerSeconds} aria-valuenow={left} className="relative z-10 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full transition-[width] duration-200 ${urgent ? "bg-red" : "bg-cyan"}`} style={{ width: `${pct}%` }} />
      </div>

      <h1 className="relative z-10 text-2xl leading-snug font-bold sm:text-3xl">{prompt}</h1>
      {code && (
        <pre className="relative z-10 overflow-x-auto rounded-xl border border-line bg-bg px-4 py-3 font-mono text-base leading-relaxed sm:text-lg">
          {code}
        </pre>
      )}

      <form
        className="relative z-10 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice.trim()) void submit(choice);
        }}
      >
        {question.type === "mcq" ? (
          <div role="radiogroup" aria-label="Answer options" className="grid gap-3 sm:grid-cols-2">
            {(question.options ?? []).map((opt, i) => {
              const selected = choice === String(i);
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={state !== "answering"}
                  onClick={() => setChoice(String(i))}
                  className={`min-h-14 rounded-xl border px-4 py-3 text-left text-lg ${
                    selected ? "border-2 border-cyan bg-cyan/10" : "border-line bg-bg"
                  }`}
                >
                  <span className="mr-3 font-display text-cyan">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="answer" className="text-sm text-muted">
              Your answer (one word)
            </label>
            <input
              id="answer"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              value={choice}
              disabled={state !== "answering"}
              onChange={(e) => setChoice(e.target.value)}
              className="min-h-14 rounded-xl border border-line bg-bg px-4 text-lg outline-none focus:border-cyan"
            />
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">{error}</p>}
        <Button type="submit" size="lg" disabled={!choice.trim() || state !== "answering"}>
          {state === "sending" ? "Sending…" : state === "timeout" ? "Time's up" : "Submit answer"}
        </Button>
        <p className="text-center text-sm text-muted">Stay on this screen. You won&apos;t see if you&apos;re right: the host will call you.</p>
      </form>

      {guard.warning && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="left-title" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center">
          <p id="left-title" className="font-display text-3xl font-black text-red">YOU LEFT THE GAME</p>
          <p className="max-w-sm text-text/80">Leaving the screen while answering is reported to the host.</p>
          <Button variant="ghost" size="lg" onClick={guard.dismiss}>
            Back to the question
          </Button>
        </div>
      )}
    </section>
  );
}
