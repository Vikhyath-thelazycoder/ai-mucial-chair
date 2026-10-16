import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adminAccess } from "./model";

describe("server-side admin guard", () => {
  it("the console layout checks access on the server before rendering anything", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/admin/(console)/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/^"use client"/m);
    expect(layout).toMatch(/getServerSupabase/);
    expect(layout).toMatch(/adminAccess/);
    expect(layout).toMatch(/redirect\("\/admin\/login"\)/);
  });

  it("only 'allow' renders the console", () => {
    for (const signedIn of [true, false]) {
      for (const admin of [true, false]) {
        expect(adminAccess({ signedIn, admin }) === "allow").toBe(signedIn && admin);
      }
    }
  });
});
