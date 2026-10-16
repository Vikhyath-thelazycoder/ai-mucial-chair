import { describe, expect, it } from "vitest";
import { chairUrl, parseChairQr } from "./qr";

const id = "3f1c2b8e-9a4d-4c1e-8f2a-1b2c3d4e5f60";
const secret = "a".repeat(48);
const hosts = ["aimc.vercel.app", "localhost:3000"];

describe("chairUrl / parseChairQr", () => {
  it("round-trips a chair QR", () => {
    const url = chairUrl("https://aimc.vercel.app", id, secret);
    expect(url).toBe(`https://aimc.vercel.app/c/${id}?k=${secret}`);
    expect(parseChairQr(url, hosts)).toEqual({ chairId: id, secret });
  });

  it.each([
    ["random text", "hello"],
    ["another site", `https://evil.example/c/${id}?k=${secret}`],
    ["wrong path", `https://aimc.vercel.app/x/${id}?k=${secret}`],
    ["bad chair id", `https://aimc.vercel.app/c/not-a-uuid?k=${secret}`],
    ["short secret", `https://aimc.vercel.app/c/${id}?k=abc`],
    ["non-hex secret", `https://aimc.vercel.app/c/${id}?k=${"z".repeat(48)}`],
    ["javascript url", "javascript:alert(1)"],
    ["extra path", `https://aimc.vercel.app/c/${id}/x?k=${secret}`],
  ])("ignores %s", (_label, text) => {
    expect(parseChairQr(text, hosts)).toBeNull();
  });
});
