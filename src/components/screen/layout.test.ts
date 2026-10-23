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

  it("drag-to-rotate on the projector and phones, with automatic zoom", () => {
    expect(app).toMatch(/<StageScene [^>]*\binteractive\b/);
    expect(stage).toMatch(/<OrbitControls[^>]*enableZoom=\{false\}[^>]*enablePan=\{false\}/);
  });
});

describe("player screen live stage (mobile)", () => {
  const phone = src("components/player/PlayerStage.tsx");
  const status = src("components/player/StatusPanel.tsx");
  const stage = src("components/three/StageScene.tsx");

  it("the status screen shows the same live stage as the projector: seats, people, reveal and podium", () => {
    expect(status).toMatch(/<PlayerStage /);
    expect(phone).toMatch(/useStageSeats\(version\)/);
    expect(phone).toMatch(/screenView\(pub, seats\)/);
    expect(phone).toMatch(/<StageScene[^>]*\bshowPeople\b[^>]*\binteractive\b[^>]*\bcompact\b/);
    expect(phone).toMatch(/podium=\{podium\}/);
  });

  it("is phone-sized and light: bounded height, clipped tags, low quality, capped pixel ratio", () => {
    expect(phone).toMatch(/h-\[clamp\(260px,48dvh,460px\)\] w-full overflow-hidden/);
    expect(phone).toMatch(/quality="low"/);
    expect(phone).toMatch(/maxDpr=\{1\.5\}/);
  });

  it("compact mode keeps tags a readable fixed size and only turns the ring", () => {
    expect(stage).toMatch(/distanceFactor=\{compact \? undefined : 7\}/);
    expect(stage).toMatch(/minPolarAngle=\{compact \? FIT_POLAR/);
    expect(stage).toMatch(/maxPolarAngle=\{compact \? FIT_POLAR/);
  });
});
