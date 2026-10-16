import { describe, expect, it } from "vitest";
import { stripChairSecret } from "./chairLink";

describe("stripChairSecret", () => {
  it("drops the query from chair links", () => {
    const out = stripChairSecret(new URL(`https://aimc.app/c/abc?k=${"f".repeat(48)}`));
    expect(out?.toString()).toBe("https://aimc.app/c/abc");
  });

  it("leaves other pages and already-clean chair links alone", () => {
    expect(stripChairSecret(new URL("https://aimc.app/c/abc"))).toBeNull();
    expect(stripChairSecret(new URL("https://aimc.app/play?k=1"))).toBeNull();
  });
});
