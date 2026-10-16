import { describe, expect, it } from "vitest";
import { buildCsp, staticSecurityHeaders } from "./csp";

const supabaseUrl = "https://abc.supabase.co";

function directives(csp: string) {
  return Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

describe("buildCsp", () => {
  const prod = directives(buildCsp({ nonce: "n0nce", supabaseUrl, dev: false }));

  it("locks scripts to self, the nonce and the Spotify SDK, without unsafe-eval in production", () => {
    expect(prod["script-src"]).toEqual(
      expect.arrayContaining(["'self'", "'nonce-n0nce'", "'strict-dynamic'", "https://sdk.scdn.co"]),
    );
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(prod["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("allows Supabase over https and wss and the Spotify APIs only", () => {
    expect(prod["connect-src"]).toEqual(
      expect.arrayContaining([
        "'self'",
        "https://abc.supabase.co",
        "wss://abc.supabase.co",
        "https://api.spotify.com",
        "https://accounts.spotify.com",
      ]),
    );
  });

  it("forbids framing, plugins and foreign base/form targets", () => {
    expect(prod["frame-ancestors"]).toEqual(["'none'"]);
    expect(prod["object-src"]).toEqual(["'none'"]);
    expect(prod["base-uri"]).toEqual(["'self'"]);
    expect(prod["form-action"]).toEqual(["'self'"]);
    expect(prod["default-src"]).toEqual(["'self'"]);
  });

  it("adds unsafe-eval only in development (Next.js dev tooling)", () => {
    const dev = directives(buildCsp({ nonce: "n", supabaseUrl, dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
  });
});

describe("staticSecurityHeaders", () => {
  const h = Object.fromEntries(staticSecurityHeaders().map((x) => [x.key, x.value]));

  it("sets every header SECURITY.md requires", () => {
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Permissions-Policy"]).toContain("camera=(self)");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
  });
});
