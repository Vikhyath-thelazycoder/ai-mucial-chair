import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, tokens } from "./tokens";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("design tokens", () => {
  it("globals.css defines every token with the value from DESIGN.md", () => {
    for (const [name, value] of Object.entries(tokens)) {
      expect(css).toMatch(new RegExp(`--${name}:\\s*${value};`, "i"));
    }
  });

  it.each(["text", "muted", "cyan", "lime", "amber", "red", "gold"] as const)(
    "%s meets 4.5:1 contrast on bg and surface",
    (name) => {
      expect(contrastRatio(tokens[name], tokens.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens[name], tokens.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("computes known contrast ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
});
