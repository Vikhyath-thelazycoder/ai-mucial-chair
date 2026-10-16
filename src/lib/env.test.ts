import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xyz",
};

describe("parsePublicEnv", () => {
  it("accepts a complete public env", () => {
    expect(parsePublicEnv(valid).NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
  });

  it("treats the Spotify client id as optional", () => {
    expect(parsePublicEnv(valid).NEXT_PUBLIC_SPOTIFY_CLIENT_ID).toBeUndefined();
  });

  it("fails fast naming every missing required variable", () => {
    expect(() => parsePublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("treats the site URL as optional (QR codes then use the page's own address)", () => {
    expect(parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: undefined }).NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it("forgives quotes, spaces and a trailing slash pasted into a hosting dashboard", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: ' "https://aimc.vercel.app/" ',
      NEXT_PUBLIC_SUPABASE_URL: "'https://abc.supabase.co'",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: " sb_publishable_xyz\n",
    });
    expect(env).toMatchObject({
      NEXT_PUBLIC_SITE_URL: "https://aimc.vercel.app",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xyz",
    });
  });

  it("rejects a non-URL Supabase URL", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("refuses a secret key in the public anon slot", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_leak" }),
    ).toThrow(/secret/i);
  });
});
