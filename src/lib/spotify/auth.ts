// Spotify token lifecycle. The token is a third-party token, so it lives only in this tab's sessionStorage
// and is cleared on logout (SECURITY.md › Secrets).
import { authorizeUrl, codeChallenge, randomVerifier, redirectUri } from "./pkce";

const TOKEN_KEY = "aimc.spotify.token";
const PENDING_KEY = "aimc.spotify.pkce";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
/** Refresh this long before expiry so a request never goes out with a dying token. */
const EARLY_MS = 60_000;

export type SpotifyToken = { accessToken: string; refreshToken: string; expiresAt: number };
type Pending = { verifier: string; state: string; returnTo: string };

export type AuthDeps = {
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  fetch: typeof fetch;
  now: () => number;
};

const browserDeps = (): AuthDeps => ({ storage: window.sessionStorage, fetch: window.fetch.bind(window), now: Date.now });

function read<T>(deps: AuthDeps, key: string): T | null {
  try {
    const raw = deps.storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function loadToken(deps: AuthDeps = browserDeps()): SpotifyToken | null {
  const t = read<SpotifyToken>(deps, TOKEN_KEY);
  return t && typeof t.accessToken === "string" && typeof t.refreshToken === "string" ? t : null;
}

export function clearSpotifyToken(deps: Pick<AuthDeps, "storage"> = browserDeps()): void {
  deps.storage.removeItem(TOKEN_KEY);
  deps.storage.removeItem(PENDING_KEY);
}

/** Starts the login: remembers the verifier and state for the callback and returns Spotify's authorize URL. */
export async function beginLogin(
  { clientId, origin, returnTo }: { clientId: string; origin: string; returnTo: string },
  deps: AuthDeps = browserDeps(),
): Promise<string> {
  const verifier = randomVerifier();
  const state = randomVerifier(24);
  deps.storage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, returnTo } satisfies Pending));
  return authorizeUrl({ clientId, redirectUri: redirectUri(origin), challenge: await codeChallenge(verifier), state });
}

export class SpotifyAuthError extends Error {}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function postToken(body: Record<string, string>, deps: AuthDeps): Promise<TokenResponse> {
  const res = await deps.fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new SpotifyAuthError(`Spotify sign-in failed (${res.status}).`);
  const json = (await res.json()) as Partial<TokenResponse>;
  if (typeof json.access_token !== "string" || typeof json.expires_in !== "number") {
    throw new SpotifyAuthError("Spotify sent an unexpected sign-in reply.");
  }
  return json as TokenResponse;
}

function save(res: TokenResponse, previousRefresh: string | null, deps: AuthDeps): SpotifyToken {
  const refreshToken = res.refresh_token ?? previousRefresh;
  if (!refreshToken) throw new SpotifyAuthError("Spotify didn't return a refresh token.");
  const token = { accessToken: res.access_token, refreshToken, expiresAt: deps.now() + res.expires_in * 1000 };
  deps.storage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

/**
 * Finishes the login on the callback page. The pending verifier is consumed first, so a replayed or
 * forged callback (wrong `state`) can't be exchanged. Returns where to send the admin next.
 */
export async function completeLogin(
  { params, clientId, origin }: { params: URLSearchParams; clientId: string; origin: string },
  deps: AuthDeps = browserDeps(),
): Promise<string> {
  const pending = read<Pending>(deps, PENDING_KEY);
  deps.storage.removeItem(PENDING_KEY);
  const error = params.get("error");
  if (error) throw new SpotifyAuthError(error === "access_denied" ? "Spotify access was declined." : `Spotify sign-in failed: ${error}.`);
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) {
    throw new SpotifyAuthError("This Spotify sign-in link is stale. Connect Spotify again.");
  }
  const res = await postToken(
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(origin),
      client_id: clientId,
      code_verifier: pending.verifier,
    },
    deps,
  );
  save(res, null, deps);
  return pending.returnTo.startsWith("/admin") ? pending.returnTo : "/admin/music";
}

let refreshing: Promise<SpotifyToken | null> | null = null;

async function refresh(clientId: string, token: SpotifyToken, deps: AuthDeps): Promise<SpotifyToken | null> {
  try {
    const res = await postToken({ grant_type: "refresh_token", refresh_token: token.refreshToken, client_id: clientId }, deps);
    return save(res, token.refreshToken, deps);
  } catch {
    // A refresh token that no longer works means the admin has to connect again.
    clearSpotifyToken(deps);
    return null;
  }
}

/** A usable access token, refreshing in the background when it's near expiry. Null when not connected. */
export async function getAccessToken(
  clientId: string,
  { force = false }: { force?: boolean } = {},
  deps: AuthDeps = browserDeps(),
): Promise<string | null> {
  const token = loadToken(deps);
  if (!token) return null;
  if (!force && token.expiresAt - EARLY_MS > deps.now()) return token.accessToken;
  // Concurrent callers (SDK + API) share one refresh: Spotify may rotate the refresh token.
  refreshing ??= refresh(clientId, token, deps).finally(() => {
    refreshing = null;
  });
  return (await refreshing)?.accessToken ?? null;
}
