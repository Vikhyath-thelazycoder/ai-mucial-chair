import { describe, expect, it } from "vitest";
import { fitCamera, SEAT_LIGHT, SHIRT_COLORS, shirtColor } from "./stage";

describe("shirtColor", () => {
  it("is stable per name and drawn from the palette", () => {
    expect(shirtColor("Asha")).toBe(shirtColor("Asha"));
    for (const n of ["Asha", "Ravi", "Meera", "Arjun Kumar", "ಕನ್ನಡ"]) expect(SHIRT_COLORS).toContain(shirtColor(n));
  });

  it("varies across players", () => {
    const names = Array.from({ length: 30 }, (_, i) => `Player ${i}`);
    expect(new Set(names.map(shirtColor)).size).toBeGreaterThan(5);
  });
});

describe("SEAT_LIGHT", () => {
  it("green for right, red for wrong, none for an empty chair", () => {
    expect(SEAT_LIGHT.correct).toMatch(/^#2B/);
    expect(SEAT_LIGHT.wrong).toBe("#FF3B5C");
    expect(SEAT_LIGHT.empty).toBeNull();
  });
});

describe("fitCamera", () => {
  const halfWidthVisible = (pos: number[], aspect: number, fov: number) => {
    const dist = Math.hypot(pos[1] - 0.8, pos[2]);
    const h = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
    return dist * Math.tan(h / 2);
  };

  it("keeps the whole ring in view on a 16:9 projector and a portrait phone", () => {
    for (const [radius, aspect] of [[1.4, 16 / 9], [4, 16 / 9], [4, 9 / 16], [8, 4 / 3]]) {
      const { position } = fitCamera(radius, aspect, 38);
      expect(halfWidthVisible(position, aspect, 38)).toBeGreaterThanOrEqual(radius + 0.75);
    }
  });

  it("moves back for bigger rings and looks at the stage centre", () => {
    expect(fitCamera(6, 16 / 9, 38).position[2]).toBeGreaterThan(fitCamera(2, 16 / 9, 38).position[2]);
    expect(fitCamera(2, 16 / 9, 38).target).toEqual([0, 0.8, 0]);
  });
});
