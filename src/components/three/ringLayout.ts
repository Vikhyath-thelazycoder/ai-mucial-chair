/** Real-scale chairs (≈0.45 m wide) need ≈0.85 m of ring each, with a sensible minimum for 1–3 chairs. */
export function stageRadius(count: number): number {
  return Math.max(1.4, (count * 0.85) / (2 * Math.PI));
}

export type RingSlot = { position: [number, number, number]; rotationY: number };

/** Positions `count` chairs evenly on an ellipse in the XZ plane, each turned to face the centre. */
export function ringLayout(count: number, radiusX: number, radiusZ: number): RingSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.sin(angle) * radiusX;
    const z = Math.cos(angle) * radiusZ;
    return { position: [x, 0, z], rotationY: Math.atan2(-x, -z) };
  });
}
