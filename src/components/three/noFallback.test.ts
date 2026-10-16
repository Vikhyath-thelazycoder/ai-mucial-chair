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

  it("the home page, player status ring and projector all render the realistic stage", () => {
    expect(src("components/three/ChairRing.tsx")).toMatch(/import\("\.\/StageScene"\)/);
    expect(src("components/screen/ScreenApp.tsx")).toMatch(/<StageScene /);
    expect(src("components/screen/ScreenApp.tsx")).not.toMatch(/lowPower|ChairRing2D/);
    expect(src("app/page.tsx")).toMatch(/<ChairRing /);
  });

  it("slow devices drop to low quality instead of 2D", () => {
    expect(src("components/three/StageScene.tsx")).toMatch(/onDecline=\{\(\) => setQuality\("low"\)\}/);
    expect(src("components/player/StatusPanel.tsx")).toMatch(/quality="low"/);
  });
});
