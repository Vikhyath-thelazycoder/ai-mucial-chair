// Pure helpers for the projector's 3D stage (kept out of the R3F components so they can be unit-tested).
import type { SeatState } from "./view";

/** Everyday shirt colours; each player keeps the same one all game (hashed from their name). */
export const SHIRT_COLORS = ["#E9E6E0", "#2F4F7F", "#8B1E2D", "#3E5F3A", "#C9A227", "#26262C", "#6B4E9B", "#D9772B", "#4A90A4", "#B5BCC4"] as const;

export function shirtColor(name: string): string {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return SHIRT_COLORS[(h >>> 0) % SHIRT_COLORS.length];
}

export const SEAT_LIGHT: Record<SeatState, string | null> = {
  empty: null,
  seated: "#FFE7C2", // warm stage white: someone sat, result not shown yet
  correct: "#2BE36F", // green: right answer
  wrong: "#FF3B5C", // red: wrong answer
};

/**
 * Camera that fits the whole ring (chairs, seated people and name tags) into the viewport at any aspect
 * ratio, looking down at ~26°. `radius` is the ring radius in metres; fov is vertical, in degrees.
 */
export function fitCamera(radius: number, aspect: number, fovDeg: number): { position: [number, number, number]; target: [number, number, number] } {
  const v = (fovDeg * Math.PI) / 180;
  const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(aspect, 0.3));
  const halfWidth = radius + 0.75; // chair depth + shoulders beyond the ring
  const halfHeight = radius * Math.sin((26 * Math.PI) / 180) + 1.2; // ring seen at an angle + people and tags
  const dist = Math.max(halfWidth / Math.tan(h / 2), halfHeight / Math.tan(v / 2)) * 1.06;
  const pitch = (26 * Math.PI) / 180;
  return { position: [0, 0.8 + dist * Math.sin(pitch), dist * Math.cos(pitch)], target: [0, 0.8, 0] };
}
