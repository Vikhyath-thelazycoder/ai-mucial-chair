"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";

// three.js and the chair model download only when a ring is on screen (TRD › /play bundle budget).
const StageScene = dynamic(() => import("./StageScene"), { ssr: false });

type Props = { count: number; className?: string; maxDpr?: number; quality?: "high" | "low" };

/** A slowly turning ring of the realistic Blender chairs (player status screen). Always 3D; no 2D fallback. */
export function ChairRing({ count, className = "", maxDpr, quality = "high" }: Props) {
  const reducedMotion = Boolean(useReducedMotion());
  const chairs = Array.from({ length: count }, (_, i) => ({ number: i + 1, occupant: null, state: "empty" as const, leaving: false }));
  return (
    <div className={className}>
      <StageScene chairs={chairs} spinning={!reducedMotion} podium={null} confettiKey={null} reducedMotion={reducedMotion} quality={quality} maxDpr={maxDpr} />
    </div>
  );
}
