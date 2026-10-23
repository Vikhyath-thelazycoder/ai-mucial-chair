import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("realistic 3D everywhere (D-020)", () => {
  it("the 2D chair drawing and the neon chair are gone", () => {
    for (const f of ["components/three/ChairRing2D.tsx", "components/three/NeonChair.tsx", "components/three/ChairRingScene.tsx"]) {
      expect(existsSync(join(process.cwd(), "src", f))).toBe(false);
    }
  });

  it("the player status ring and projector render the realistic stage", () => {
    expect(src("components/player/PlayerStage.tsx")).toMatch(/import\("@\/components\/three\/StageScene"\)/);
    expect(src("components/screen/ScreenApp.tsx")).toMatch(/<StageScene /);
    expect(src("components/screen/ScreenApp.tsx")).not.toMatch(/lowPower|ChairRing2D/);
  });

  it("the main link goes straight to the admin login, with no landing page", () => {
    const home = src("app/page.tsx");
    expect(home).toMatch(/redirect\("\/admin"\)/);
    expect(home).not.toMatch(/Grab a chair|ChairRing/);
  });

  it("the projector shows no join QR code", () => {
    expect(src("components/screen/Overlays.tsx")).not.toMatch(/QrImage|\/play/);
  });

  it("slow devices drop to low quality instead of 2D", () => {
    expect(src("components/three/StageScene.tsx")).toMatch(/onDecline=\{\(\) => setQuality\("low"\)\}/);
    expect(src("components/player/PlayerStage.tsx")).toMatch(/quality="low"/);
  });
});
