"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useStageChairs } from "@/hooks/useStageChairs";
import { useStageSeats } from "@/hooks/useStageSeats";
import type { PublicState } from "@/lib/game/types";
import { screenView } from "@/lib/screen/view";

// three.js and the models download only when the stage is on screen (TRD › /play bundle budget).
const StageScene = dynamic(() => import("@/components/three/StageScene"), { ssr: false });

/**
 * The projector's live 3D stage on the phone: who is seated, the green/red reveal and the podium, exactly as
 * the hall sees it. Phone mode: low quality, capped pixel ratio, fixed-size name tags, drag to turn the ring.
 */
export function PlayerStage({ pub, version }: { pub: PublicState; version: number }) {
  const seats = useStageSeats(version);
  const view = screenView(pub, seats);
  const chairs = useStageChairs(view.seats);
  const reducedMotion = Boolean(useReducedMotion());
  const podium = view.stage === "podium" ? view.winners : null;
  return (
    <div className="relative h-[clamp(260px,48dvh,460px)] w-full overflow-hidden rounded-2xl border border-line/60">
      <StageScene
        chairs={chairs}
        spinning={view.stage === "music"}
        podium={podium}
        confettiKey={podium ? 1 : null}
        reducedMotion={reducedMotion}
        showPeople
        interactive
        compact
        quality="low"
        maxDpr={1.5}
      />
    </div>
  );
}
