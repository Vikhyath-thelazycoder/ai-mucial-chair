import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("projector layout (names never hidden)", () => {
  const app = src("components/screen/ScreenApp.tsx");
  const overlays = src("components/screen/Overlays.tsx");
  const stage = src("components/three/StageScene.tsx");

  it("stacks header, stage and state words as separate bands, the stage clipping its name tags", () => {
    const hud = app.indexOf("<Hud ");
    const scene = app.indexOf("<StageScene ");
    const word = app.indexOf("<StageWord ");
    expect(hud).toBeGreaterThan(-1);
    expect(hud).toBeLessThan(scene);
    expect(scene).toBeLessThan(word);
    expect(app).toMatch(/flex h-dvh w-full flex-col/);
    expect(app).toMatch(/min-h-0 flex-1 cursor-grab overflow-hidden/);
  });

  it("the header and the SCAN NOW / WALK! / results band are not floating over the stage", () => {
    const header = /<header className="([^"]+)"/.exec(overlays)![1];
    expect(header).not.toMatch(/\babsolute\b/);
    const band = /<div data-stage-band className="([^"]+)"/.exec(overlays)![1];
    expect(band).not.toMatch(/\babsolute\b/);
    expect(band).toMatch(/shrink-0/);
  });

  it("shows full names (wrapping, never truncated) and lifts overlapping tags", () => {
    expect(stage).not.toMatch(/truncate/);
    expect(stage).toMatch(/break-words/);
    expect(stage).toMatch(/placeLabels\(/);
  });

  it("drag-to-rotate is on the projector only, with automatic zoom", () => {
    expect(app).toMatch(/<StageScene [^>]*\binteractive\b/);
    expect(src("components/three/ChairRing.tsx")).not.toMatch(/\binteractive\b/);
    expect(stage).toMatch(/<OrbitControls[^>]*enableZoom=\{false\}[^>]*enablePan=\{false\}/);
  });
});
