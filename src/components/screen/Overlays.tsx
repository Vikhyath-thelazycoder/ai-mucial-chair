"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Sequence } from "@/lib/screen/sequence";
import type { ScreenView } from "@/lib/screen/view";

// Projector type is sized in vw so it stays readable from the back of a hall (≥ 48 px at 1080p = 2.5vw).
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };

/** Event branding plus the only two numbers the hall needs: the round and how many chairs. */
export function Hud({ view }: { view: ScreenView }) {
  const items = [
    { label: "Round", value: view.roundNumber ?? "–" },
    { label: "Chairs", value: view.chairCount },
  ];
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-[2vw] bg-gradient-to-b from-bg/90 to-transparent p-[2vw] pb-[4vw]">
      <div>
        <p className="font-display text-[1.3vw] font-extrabold tracking-[0.35em] text-gold">TECHVIDYA</p>
        <p className="mt-[0.3vw] font-display text-[2.6vw] leading-none font-black tracking-[0.06em]">
          AI MUSICAL <span className="text-cyan [text-shadow:0_0_2vw_rgb(34_228_255/0.6)]">CHAIR</span>
        </p>
        <p className="mt-[0.5vw] text-[1.1vw] tracking-[0.12em] text-muted uppercase">Sai Vidya Institute of Technology</p>
      </div>
      <div className="flex flex-col items-end gap-[0.8vw]">
        <dl className="flex gap-[1vw]">
          {items.map((s) => (
            <div key={s.label} className="min-w-[9vw] rounded-[1vw] border border-line bg-surface/60 px-[1.2vw] py-[0.8vw] text-center backdrop-blur-md">
              <dd className="font-mono text-[3vw] leading-none font-bold tabular-nums">{s.value}</dd>
              <dt className="mt-[0.4vw] text-[1vw] tracking-[0.12em] text-muted uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>
        {view.isFinal && view.stage !== "podium" && <p className="font-display text-[1.4vw] font-extrabold tracking-[0.2em] text-gold">FINAL ROUND</p>}
      </div>
    </header>
  );
}

/** Music-state visualizer: equalizer bars that dance while the music plays (no audio is read). */
function Visualizer({ playing, reducedMotion }: { playing: boolean; reducedMotion: boolean }) {
  const bars = 24;
  return (
    <div className="flex h-[6vw] items-end justify-center gap-[0.4vw]" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <motion.span
          key={i}
          className="w-[0.8vw] rounded-full bg-cyan shadow-[0_0_14px_rgb(34_228_255/0.6)]"
          initial={{ height: "12%" }}
          animate={
            playing && !reducedMotion
              ? { height: ["15%", `${35 + ((i * 37) % 60)}%`, "25%", `${55 + ((i * 53) % 45)}%`, "15%"] }
              : { height: "12%" }
          }
          transition={playing && !reducedMotion ? { duration: 1.1 + (i % 5) * 0.13, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
        />
      ))}
    </div>
  );
}

function useSince(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [iso]);
  return iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / 1000)) : 0;
}

/** The one big state word per stage (DESIGN.md › one primary state). */
export function StageWord({ view, reducedMotion }: { view: ScreenView; reducedMotion: boolean }) {
  const since = useSince(view.scanOpenedAt);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-[1vw] p-[2.5vw] text-center">
      <AnimatePresence mode="wait">
        {view.stage === "lobby" && (
          <motion.div key="lobby" {...fade}>
            <p className="font-display text-[4vw] leading-none font-black tracking-[0.08em]">GET READY</p>
            <p className="mt-[0.8vw] text-[1.8vw] text-muted">The game starts soon</p>
          </motion.div>
        )}
        {view.stage === "music" && (
          <motion.div key="music" {...fade} className="flex flex-col items-center gap-[1vw]">
            <Visualizer playing reducedMotion={reducedMotion} />
            <p className="font-display text-[5vw] leading-none font-black tracking-[0.1em] text-cyan drop-shadow-[0_0_30px_rgb(34_228_255/0.5)]">WALK!</p>
          </motion.div>
        )}
        {view.stage === "scan" && (
          <motion.div key="scan" {...fade} className="flex flex-col items-center">
            <motion.p
              className="font-display text-[9vw] leading-none font-black text-amber drop-shadow-[0_0_50px_rgb(255_176_32/0.7)]"
              animate={reducedMotion ? { opacity: 1 } : { scale: [1, 1.12, 1, 1.12, 1] }}
              transition={{ duration: 1.2, times: [0, 0.25, 0.5, 0.75, 1] }}
            >
              SCAN NOW
            </motion.p>
            <p className="mt-[0.6vw] font-mono text-[2.4vw] text-amber tabular-nums">
              {String(Math.floor(since / 60)).padStart(2, "0")}:{String(since % 60).padStart(2, "0")}
            </p>
          </motion.div>
        )}
        {view.stage === "judging" && !view.revealed && (
          <motion.p key="judging" {...fade} className="font-display text-[3.4vw] font-extrabold tracking-[0.06em]">
            Checking answers…
          </motion.p>
        )}
        {view.stage === "judging" && view.revealed && (
          <motion.div key="results" {...fade} className="flex items-center gap-[3vw] font-display text-[3.6vw] font-black">
            <span className="text-[#2BE36F] drop-shadow-[0_0_24px_rgb(43_227_111/0.6)]">✓ {view.correct} RIGHT</span>
            <span className="text-red drop-shadow-[0_0_24px_rgb(255_59_92/0.6)]">✗ {view.wrong} WRONG</span>
          </motion.div>
        )}
        {view.stage === "between" && (
          <motion.div key="between" {...fade}>
            <p className="font-display text-[3.4vw] font-extrabold">ROUND {view.roundNumber} COMPLETE</p>
            <p className="mt-[0.6vw] text-[1.8vw] text-muted">Next round soon</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Full-screen stings driven by event_seq; each plays once (sequence.ts). */
export function SequenceOverlay({ sequence, reducedMotion }: { sequence: Sequence | null; reducedMotion: boolean }) {
  return (
    <AnimatePresence>
      {sequence && sequence.kind !== "podium" && (
        <motion.div
          key={sequence.seq}
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-bg/75 text-center backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {sequence.kind === "round_start" && (
            <motion.p
              className={`font-display font-black tracking-[0.08em] ${sequence.isFinal ? "text-[9vw] text-gold drop-shadow-[0_0_60px_rgb(255_213_74/0.6)]" : "text-[7vw] text-cyan"}`}
              initial={reducedMotion ? { opacity: 0 } : { scale: 1.6, opacity: 0, letterSpacing: "0.4em" }}
              animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, letterSpacing: "0.08em" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {sequence.isFinal ? "FINAL ROUND" : `ROUND ${sequence.round}`}
            </motion.p>
          )}
          {sequence.kind === "round_over" && (
            <div>
              <p className="font-display text-[6vw] font-black">ROUND {sequence.round} OVER</p>
              {sequence.eliminated.length > 0 && (
                <>
                  <p className="mt-[1.5vw] text-[1.6vw] tracking-[0.2em] text-red uppercase">Out this round</p>
                  <ul className="mx-auto mt-[1vw] flex max-w-[80vw] flex-wrap justify-center gap-x-[2vw] gap-y-[0.8vw]">
                    {sequence.eliminated.map((name, i) => (
                      <motion.li
                        key={`${name}-${i}`}
                        className="font-display text-[2.6vw] font-extrabold text-text/90"
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
                        transition={{ delay: 1.2 + i * 0.25, duration: 1.2 }}
                      >
                        {name}
                      </motion.li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {sequence.kind === "new_game" && <p className="font-display text-[6vw] font-black text-cyan">NEW GAME</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
