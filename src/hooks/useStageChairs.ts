"use client";

import { useEffect, useState } from "react";
import type { StageChair } from "@/components/three/StageScene";
import { mergePresence, type PresentChair } from "@/lib/screen/sequence";
import type { StageSeat } from "@/lib/screen/view";

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

/** The chairs the 3D stage draws (projector and phones): live seats plus removed chairs still sinking away. */
export function useStageChairs(seats: StageSeat[]): StageChair[] {
  const presence = useChairPresence(seats.map((c) => c.number));
  const byNumber = new Map(seats.map((c) => [c.number, c]));
  return presence.map((c) => ({
    ...c,
    occupant: byNumber.get(c.number)?.occupant ?? null,
    state: byNumber.get(c.number)?.state ?? ("empty" as const),
  }));
}
