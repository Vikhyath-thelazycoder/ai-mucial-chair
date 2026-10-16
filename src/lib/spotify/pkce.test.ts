import { describe, expect, it } from "vitest";
import { authorizeUrl, codeChallenge, randomVerifier, redirectUri, SPOTIFY_SCOPES } from "./pkce";

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B S256 test vector", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes verifiers of unreserved characters only, different every time", () => {
    const a = randomVerifier();
    const b = randomVerifier();
    expect(a).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(a).not.toBe(b);
  });

  it("builds the authorize URL with S256, state and only the scopes we need", () => {
    const url = new URL(authorizeUrl({ clientId: "cid", redirectUri: redirectUri("http://127.0.0.1:3000/"), challenge: "chal", state: "st" }));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "cid",
      scope: SPOTIFY_SCOPES.join(" "),
      redirect_uri: "http://127.0.0.1:3000/admin/spotify/callback",
      code_challenge_method: "S256",
      code_challenge: "chal",
      state: "st",
    });
    expect(SPOTIFY_SCOPES).not.toContain("playlist-modify-private");
    expect(SPOTIFY_SCOPES).not.toContain("user-library-modify");
  });
});
