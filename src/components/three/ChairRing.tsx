"use client";

import dynamic from "next/dynamic";
import { useLowPower } from "@/hooks/lowPower";
import { ChairRing2D } from "./ChairRing2D";

const ChairRingScene = dynamic(() => import("./ChairRingScene"), { ssr: false });

type Props = { count: number; lit?: ReadonlySet<number>; className?: string; maxDpr?: number };

/** 3D ring on capable devices; 2D fallback otherwise. three.js is only downloaded when 3D is used. */
export function ChairRing({ count, lit, className = "", maxDpr }: Props) {
  const { lowPower, markSlow } = useLowPower();
  if (lowPower) {
    return (
      <div className={className}>
        <ChairRing2D count={count} lit={lit} />
      </div>
    );
  }
  return (
    <div className={className}>
      <ChairRingScene count={count} lit={lit} onSlow={markSlow} maxDpr={maxDpr} />
    </div>
  );
}
