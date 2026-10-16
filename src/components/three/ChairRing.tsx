"use client";

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";

// three.js and the chair model download only when a ring is on screen (TRD › /play bundle budget).
const StageScene = dynamic(() => import("./StageScene"), { ssr: false });

type Props = { count: number; lit?: ReadonlySet<number>; className?: string; maxDpr?: number; quality?: "high" | "low" };

/** A slowly turning ring of the realistic Blender chairs (home page, player status). Always 3D; no 2D fallback. */
export function ChairRing({ count, lit, className = "", maxDpr, quality = "high" }: Props) {
  const reducedMotion = Boolean(useReducedMotion());
  const chairs = Array.from({ length: count }, (_, i) => ({ number: i + 1, holder: null, leaving: false, lit: lit?.has(i) ?? false }));
  return (
    <div className={className}>
      <StageScene chairs={chairs} spinning={!reducedMotion} podium={null} confettiKey={null} reducedMotion={reducedMotion} quality={quality} maxDpr={maxDpr} />
    </div>
  );
}
