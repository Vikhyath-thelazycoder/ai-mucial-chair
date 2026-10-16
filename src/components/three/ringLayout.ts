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
