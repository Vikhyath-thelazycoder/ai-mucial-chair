import { describe, expect, it } from "vitest";
import { ringLayout, stageRadius } from "./ringLayout";

describe("ringLayout", () => {
  it("places one slot per chair on the ellipse, facing the centre", () => {
    const slots = ringLayout(4, 5, 3);
    expect(slots).toHaveLength(4);
    expect(slots[0].position[0]).toBeCloseTo(0);
    expect(slots[0].position[2]).toBeCloseTo(3);
    expect(slots[1].position[0]).toBeCloseTo(5);
    expect(slots[1].position[2]).toBeCloseTo(0);
    for (const s of slots) {
      // Facing the centre: the chair's forward vector points back at the origin.
      const [x, , z] = s.position;
      const forward = [Math.sin(s.rotationY), Math.cos(s.rotationY)];
      const toCentre = [-x, -z];
      const dot = forward[0] * toCentre[0] + forward[1] * toCentre[1];
      expect(dot).toBeGreaterThan(0);
    }
  });

  it("handles any admin-chosen count, including 0 and 1", () => {
    expect(ringLayout(0, 5, 3)).toEqual([]);
    expect(ringLayout(1, 5, 3)).toHaveLength(1);
    expect(ringLayout(50, 5, 3)).toHaveLength(50);
  });
});

describe("stageRadius", () => {
  it("gives every real-size chair room on the ring, with a minimum for small rounds", () => {
    expect(stageRadius(1)).toBe(1.4);
    expect(stageRadius(3)).toBe(1.4);
    for (const n of [12, 30, 60]) {
      const spacing = (2 * Math.PI * stageRadius(n)) / n;
      expect(spacing).toBeGreaterThanOrEqual(0.85 - 1e-9);
    }
  });
});
