"use client";

import { useEffect, useState } from "react";

export type PowerSignals = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
  reducedMotion?: boolean;
};

/** DESIGN.md › Motion: fall back to 2D on weak devices or when the user asks for less motion. */
export function isLowPower(s: PowerSignals): boolean {
  if (s.reducedMotion || s.saveData) return true;
  if (s.hardwareConcurrency !== undefined && s.hardwareConcurrency <= 4) return true;
  if (s.deviceMemory !== undefined && s.deviceMemory <= 4) return true;
  return false;
}

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

function readSignals(): PowerSignals {
  const nav = navigator as NavigatorExtras;
  return {
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/**
 * True until the device is known to be capable, so phones never start loading 3D they can't run.
 * `markSlow` lets a running scene report a measured FPS drop and switch to the fallback.
 */
export function useLowPower(): { lowPower: boolean; markSlow: () => void } {
  const [lowPower, setLowPower] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setLowPower(isLowPower(readSignals()));
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return { lowPower, markSlow: () => setLowPower(true) };
}
