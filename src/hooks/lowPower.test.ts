import { describe, expect, it } from "vitest";
import { isLowPower } from "./lowPower";

const strong = { hardwareConcurrency: 8, deviceMemory: 8, saveData: false, reducedMotion: false };

describe("isLowPower", () => {
  it("is false on a capable device", () => {
    expect(isLowPower(strong)).toBe(false);
  });

  it.each([
    ["4 or fewer cores", { hardwareConcurrency: 4 }],
    ["4 GB or less memory", { deviceMemory: 4 }],
    ["Save-Data on", { saveData: true }],
    ["reduced motion requested", { reducedMotion: true }],
  ])("is true with %s", (_label, override) => {
    expect(isLowPower({ ...strong, ...override })).toBe(true);
  });

  it("does not penalise browsers that hide deviceMemory or core count", () => {
    expect(isLowPower({ ...strong, deviceMemory: undefined, hardwareConcurrency: undefined })).toBe(false);
  });
});
