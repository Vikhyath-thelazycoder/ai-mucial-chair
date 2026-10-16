import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Gemini model fallback", () => {
  it("tries the pinned model first, then the chain, without repeats", async () => {
    const { MODEL_CHAIN, modelOrder } = await import("./gemini");
    expect(modelOrder(undefined)).toEqual(MODEL_CHAIN);
    expect(modelOrder(" gemini-2.5-flash ")).toEqual(["gemini-2.5-flash", ...MODEL_CHAIN]);
    expect(modelOrder("gemini-flash-latest")).toEqual(MODEL_CHAIN);
  });

  it("moves on for retired, over-quota and overloaded models only", async () => {
    const { tryNextModel } = await import("./gemini");
    for (const s of [404, 429, 500, 503]) expect(tryNextModel(s)).toBe(true);
    for (const s of [400, 401, 403]) expect(tryNextModel(s)).toBe(false); // bad request or bad key: another model won't help
  });
});
