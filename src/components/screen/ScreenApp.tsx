"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { usePublicState } from "@/hooks/usePublicState";
import { useStageChairs } from "@/hooks/useStageChairs";
import { useStageSeats } from "@/hooks/useStageSeats";
import { nextSequence, type Sequence } from "@/lib/screen/sequence";
import { screenView, type ScreenView } from "@/lib/screen/view";
import { Hud, SequenceOverlay, StageWord } from "./Overlays";

const StageScene = dynamic(() => import("@/components/three/StageScene"), { ssr: false });

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
  const { state, connection, version } = usePublicState();
  const seats = useStageSeats(version);
  const view: ScreenView | null = state ? screenView(state, seats) : null;
  const chairs = useStageChairs(view?.seats ?? []);
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

  const podium = view.stage === "podium" ? view.winners : null;

  return (
    // Three bands: header, the 3D stage, and the state words. Name tags are clipped to the stage band, so
    // SCAN NOW / WALK! / results never sit on top of a player's name. Drag the stage to look around.
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-text select-none">
      <Hud view={view} />
      <div className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing">
        <StageScene chairs={chairs} spinning={view.stage === "music"} podium={podium} confettiKey={confettiKey} reducedMotion={reducedMotion} showPeople interactive maxDpr={2} />
      </div>
      <StageWord view={view} reducedMotion={reducedMotion} />
      <SequenceOverlay sequence={sequence} reducedMotion={reducedMotion} />
      {connection === "offline" && (
        <p className="absolute right-[2vw] bottom-[2vw] rounded-full border border-amber/50 bg-bg/80 px-[1vw] py-[0.4vw] text-[1vw] text-amber">Reconnecting…</p>
      )}
    </main>
  );
}
