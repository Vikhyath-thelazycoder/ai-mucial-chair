import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginLogin, clearSpotifyToken, completeLogin, getAccessToken, loadToken, type AuthDeps } from "./auth";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let storage: ReturnType<typeof memoryStorage>;
let fetchMock: ReturnType<typeof vi.fn>;
let now = 1_000_000;
let deps: AuthDeps;
const origin = "http://127.0.0.1:3000";

beforeEach(() => {
  storage = memoryStorage();
  fetchMock = vi.fn();
  now = 1_000_000;
  deps = { storage, fetch: fetchMock as unknown as typeof fetch, now: () => now };
});

async function login() {
  const url = new URL(await beginLogin({ clientId: "cid", origin, returnTo: "/admin" }, deps));
  return url.searchParams.get("state")!;
}

describe("Spotify login", () => {
  it("exchanges the code with the stored verifier and keeps the token in session storage", async () => {
    const state = await login();
    fetchMock.mockResolvedValueOnce(json({ access_token: "A1", refresh_token: "R1", expires_in: 3600 }));

    const next = await completeLogin({ params: new URLSearchParams({ code: "C", state }), clientId: "cid", origin }, deps);

    expect(next).toBe("/admin");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(body.get("redirect_uri")).toBe(`${origin}/admin/spotify/callback`);
    expect(body.has("client_secret")).toBe(false);
    expect(loadToken(deps)).toEqual({ accessToken: "A1", refreshToken: "R1", expiresAt: now + 3_600_000 });
  });

  it("rejects a callback whose state doesn't match, and can't be replayed", async () => {
    const state = await login();
    await expect(completeLogin({ params: new URLSearchParams({ code: "C", state: "forged" }), clientId: "cid", origin }, deps)).rejects.toThrow(/stale/);
    await expect(completeLogin({ params: new URLSearchParams({ code: "C", state }), clientId: "cid", origin }, deps)).rejects.toThrow(/stale/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loadToken(deps)).toBeNull();
  });

  it("reports a declined login", async () => {
    await login();
    await expect(completeLogin({ params: new URLSearchParams({ error: "access_denied" }), clientId: "cid", origin }, deps)).rejects.toThrow(/declined/);
  });

  it("never redirects outside the admin after login", async () => {
    await beginLogin({ clientId: "cid", origin, returnTo: "https://evil.example" }, deps);
    const state = JSON.parse(storage.getItem("aimc.spotify.pkce")!).state;
    fetchMock.mockResolvedValueOnce(json({ access_token: "A", refresh_token: "R", expires_in: 3600 }));
    expect(await completeLogin({ params: new URLSearchParams({ code: "C", state }), clientId: "cid", origin }, deps)).toBe("/admin/music");
  });
});

describe("access token", () => {
  const seed = (expiresAt: number) => storage.setItem("aimc.spotify.token", JSON.stringify({ accessToken: "OLD", refreshToken: "R1", expiresAt }));

  it("returns null when not connected", async () => {
    expect(await getAccessToken("cid", {}, deps)).toBeNull();
  });

  it("uses the stored token while it's fresh", async () => {
    seed(now + 10 * 60_000);
    expect(await getAccessToken("cid", {}, deps)).toBe("OLD");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes once near expiry, shared between concurrent callers, keeping the refresh token if none is returned", async () => {
    seed(now + 30_000);
    fetchMock.mockResolvedValueOnce(json({ access_token: "NEW", expires_in: 3600 }));
    const [a, b] = await Promise.all([getAccessToken("cid", {}, deps), getAccessToken("cid", {}, deps)]);
    expect([a, b]).toEqual(["NEW", "NEW"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("R1");
    expect(loadToken(deps)?.refreshToken).toBe("R1");
  });

  it("stores a rotated refresh token", async () => {
    seed(now + 10 * 60_000);
    fetchMock.mockResolvedValueOnce(json({ access_token: "NEW", refresh_token: "R2", expires_in: 3600 }));
    expect(await getAccessToken("cid", { force: true }, deps)).toBe("NEW");
    expect(loadToken(deps)?.refreshToken).toBe("R2");
  });

  it("clears the token when refresh fails, so the admin reconnects", async () => {
    seed(now - 1);
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    expect(await getAccessToken("cid", {}, deps)).toBeNull();
    expect(loadToken(deps)).toBeNull();
  });

  it("logout clears the token and any pending login", async () => {
    await login();
    seed(now + 60 * 60_000);
    clearSpotifyToken(deps);
    expect(storage.keys()).toEqual([]);
  });
});
