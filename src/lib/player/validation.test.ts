import { describe, expect, it } from "vitest";
import { loginSchema, playerEmail, registrationSchema } from "./validation";

const valid = { name: "Ananya R", usn: "4su22cs011", phone: "9876543210", branch: "CSE", pin: "482913" };

describe("registrationSchema", () => {
  it("accepts valid details and normalises the USN to upper case", () => {
    const r = registrationSchema.parse(valid);
    expect(r.usn).toBe("4SU22CS011");
  });

  it("trims and collapses spaces in the name", () => {
    expect(registrationSchema.parse({ ...valid, name: "  Ananya   R  " }).name).toBe("Ananya R");
  });

  it.each([
    ["name", "<script>alert(1)</script>"],
    ["name", "A"],
    ["name", "1337 hacker"],
    ["usn", "4SU 22"],
    ["usn", "abc"],
    ["phone", "98765"],
    ["phone", "98765432101"],
    ["phone", "98765abcde"],
    ["branch", ""],
    ["pin", "1234"],
    ["pin", "12345a"],
  ])("rejects a bad %s: %s", (field, value) => {
    const r = registrationSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path[0]).toBe(field);
  });
});

describe("loginSchema", () => {
  it("needs a USN and a 6-digit PIN", () => {
    expect(loginSchema.safeParse({ usn: "4SU22CS011", pin: "482913" }).success).toBe(true);
    expect(loginSchema.safeParse({ usn: "4SU22CS011", pin: "48" }).success).toBe(false);
  });
});

describe("playerEmail", () => {
  it("derives a stable sign-in email from the USN", () => {
    expect(playerEmail("4su22cs011")).toBe("4su22cs011@players.aimusicalchair.app");
    expect(playerEmail("4SU22CS011")).toBe(playerEmail("4su22cs011"));
  });
});
