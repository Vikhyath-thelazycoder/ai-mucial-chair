"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePublicState } from "@/hooks/usePublicState";
import { mergePresence, nextSequence, type PresentChair, type Sequence } from "@/lib/screen/sequence";
import { screenView, type ScreenView } from "@/lib/screen/view";
import { Hud, SequenceOverlay, StageWord } from "./Overlays";

const StageScene = dynamic(() => import("@/components/three/StageScene"), { ssr: false });

/** Removed chairs sink for this long before they leave the stage. */
const SINK_MS = 1800;

function useChairPresence(numbers: number[]): PresentChair[] {
  const key = numbers.join(",");
  const [presence, setPresence] = useState<PresentChair[]>([]);
  useEffect(() => {
    setPresence((prev) => mergePresence(prev, numbers));
    const t = setTimeout(() => setPresence((prev) => prev.filter((c) => !c.leaving)), SINK_MS);
    return () => clearTimeout(t);
    // `key` captures the chair list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return presence;
}

function useSequences(event: ReturnType<typeof usePublicState>["state"]) {
  const lastSeen = useRef<number | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  useEffect(() => {
    if (!event) return;
    const r = nextSequence(lastSeen.current, event.event);
    lastSeen.current = r.lastSeen;
    if (!r.play) return;
    setSequence(r.play);
    if (r.play.kind === "podium") setConfettiKey(r.play.seq);
  }, [event]);
  useEffect(() => {
    if (!sequence) return;
    const t = setTimeout(() => setSequence(null), sequence.durationMs);
    return () => clearTimeout(t);
  }, [sequence]);
  return { sequence, confettiKey };
}

/** /screen: the projector tab. Read-only; everything comes from public_state (F15). Press F for fullscreen. */
export function ScreenApp() {
  const { state, connection } = usePublicState();
  const view: ScreenView | null = state ? screenView(state) : null;
  const presence = useChairPresence(view?.chairs.map((c) => c.number) ?? []);
  const { sequence, confettiKey } = useSequences(state);
  const reducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f") return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!view) {
    return (
      <main className="grid h-dvh place-items-center bg-bg">
        <p className="font-display text-[2.5vw] text-muted motion-safe:animate-pulse">Connecting to the game…</p>
      </main>
    );
  }

  const holders = new Map(view.chairs.map((c) => [c.number, c.holder]));
  const chairs = presence.map((c) => ({ ...c, holder: holders.get(c.number) ?? null }));
  const podium = view.stage === "podium" ? view.winners : null;

  return (
    <main className="relative h-dvh w-full cursor-none overflow-hidden bg-bg text-text select-none">
      <div className="absolute inset-0">
        <StageScene chairs={chairs} spinning={view.stage === "music"} podium={podium} confettiKey={confettiKey} reducedMotion={reducedMotion} maxDpr={2} />
      </div>
      <Hud view={view} />
      <StageWord view={view} reducedMotion={reducedMotion} />
      <SequenceOverlay sequence={sequence} reducedMotion={reducedMotion} />
      {connection === "offline" && (
        <p className="absolute right-[2vw] bottom-[2vw] rounded-full border border-amber/50 bg-bg/80 px-[1vw] py-[0.4vw] text-[1vw] text-amber">Reconnecting…</p>
      )}
    </main>
  );
}
