import { describe, expect, it } from "vitest";
import { friendlyError } from "./errors";

describe("friendlyError", () => {
  it.each([
    "NOT_AUTHENTICATED",
    "NOT_REGISTERED",
    "NOT_ACTIVE",
    "ALREADY_LOCKED",
    "ALREADY_SCANNED_THIS_SPIN",
    "SCAN_WINDOW_CLOSED",
    "CHAIR_INACTIVE",
    "CHAIR_TAKEN",
    "CHAIR_LOCKED",
    "BAD_QR",
    "ALREADY_ANSWERED",
    "REGISTRATION_CLOSED",
    "DUPLICATE_USN",
    "DUPLICATE_PHONE",
    "ALREADY_REGISTERED",
    "VALIDATION",
    "NO_QUESTIONS",
  ])("has a specific message for %s", (code) => {
    const msg = friendlyError(code);
    expect(msg).not.toMatch(/something went wrong/i);
    expect(msg).not.toContain(code);
  });

  it("never echoes unknown server text (could leak internals)", () => {
    expect(friendlyError('relation "public.secret" does not exist')).toMatch(/something went wrong/i);
  });

  it("maps Supabase auth errors for a wrong PIN", () => {
    expect(friendlyError("Invalid login credentials")).toMatch(/USN or PIN/);
  });
});
