import { describe, expect, it } from "vitest";
import { clockOffset, secondsLeft } from "./countdown";

describe("countdown", () => {
  it("measures the server clock offset", () => {
    expect(clockOffset("2026-10-20T10:00:05.000Z", Date.parse("2026-10-20T10:00:00.000Z"))).toBe(5000);
  });

  it("counts down to the server deadline using the offset", () => {
    const deadline = "2026-10-20T10:00:30.000Z";
    const localNow = Date.parse("2026-10-20T10:00:00.000Z");
    expect(secondsLeft(deadline, localNow, 0)).toBe(30);
    expect(secondsLeft(deadline, localNow, 10_000)).toBe(20); // server is 10s ahead of this phone
    expect(secondsLeft(deadline, localNow + 29_200, 0)).toBe(1); // rounds up so 0 means really over
    expect(secondsLeft(deadline, localNow + 40_000, 0)).toBe(0);
  });
});
