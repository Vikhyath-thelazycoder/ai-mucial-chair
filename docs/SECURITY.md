# Security: AI Musical Chair

The threat model follows STRIDE over every trust boundary in [ARCHITECTURE.md](ARCHITECTURE.md#trust-boundaries).

## Assets and threats

| Asset | Why it matters |
|---|---|
| Answer key (`questions.answer`) | Leaking it breaks the game |
| Correctness and timing (`attempts.result`, `time_ms`) | Decides who is eliminated and the podium |
| Chair claims | Decide who keeps a seat |
| Admin powers | Can change any outcome |
| Player PII (name, USN, phone) | Personal data of students |
| Secrets (Gemini key, service-role key, Spotify token) | Cost and data exposure |

| # | Threat (STRIDE) | Abuse case | Mitigation | Test |
|---|---|---|---|---|
| T1 | Information disclosure | A player queries `questions` or `attempts` through the public anon key to read answers or correctness | No select policy for players on `questions` or `attempts`. RPCs return question data without `answer`. `submit_answer` returns only `{received:true}` | SQL: as a player, `select * from questions` returns 0 rows. The claim response has no `answer` key |
| T2 | Spoofing | An unregistered person, or a normal camera app, scans a chair QR | The `/c/[id]` page has no side effects. `claim_chair` requires `auth.uid()` with an `active` player row | SQL: anonymous → `NOT_AUTHENTICATED`; spectator → `NOT_ACTIVE` |
| T3 | Tampering | Scanning a photo of the QR before the music stops, or from far away | Claims are accepted only when `spins.phase = 'scan_open'` | SQL: phase `music` → `SCAN_WINDOW_CLOSED` |
| T4 | Tampering | Two people claim the same chair; one player claims two chairs | `FOR UPDATE` on the chair row, unique `(spin_id, chair_id)` and `(spin_id, player_id)` | SQL + simulation: concurrent claims → exactly one succeeds |
| T5 | Tampering | Forging or guessing a chair QR | 24-byte random secret per chair, compared in constant time. Secret rotation is available | SQL: wrong secret → `BAD_QR` |
| T6 | Tampering | Faking a faster time, or answering after the deadline | Times come from server `now()`. Deadline + 2 s grace is enforced → `timed_out` | SQL: answer after the deadline gives `timed_out`. The client cannot send time fields |
| T7 | Tampering | Answering twice, or changing an answer | `ALREADY_ANSWERED` once an answer is recorded | SQL |
| T8 | Elevation of privilege | A player calls admin RPCs or writes to `chairs` or `questions` | `is_admin()` check in every admin RPC. Admin-only RLS on writes. `public_state` is RPC-write only | SQL: as a player, each admin RPC → `NOT_ADMIN`; direct insert → RLS denied |
| T9 | Information disclosure | A player reads other players' phone numbers or USNs | Players see only their own `players` row. `public_state` has names only | SQL: player A can't select player B |
| T10 | Spoofing | Brute-forcing a 6-digit PIN | Supabase Auth sign-in rate limits. The USN is needed too. Accepted risk for a one-day event (low value) | `scripts/signin-burst.ts` measures the per-IP sign-in limit (default 30 per 5 min). For the fest it must be **raised** so 30+ phones on one campus WiFi can join (docs/reports/wifi-signin.md); hosts can reset a PIN |
| T11 | Repudiation | The admin changes an outcome and it's disputed | Every override needs a reason and is written to `admin_audit` (insert-only) | SQL: an override creates an audit row |
| T12 | Denial of service | Spamming `report_focus_event` or `claim_chair` | Focus events capped at 50 per attempt. Claims limited to one per spin. Gemini route rate-limited | SQL: the 51st focus event is ignored |
| T13 | Injection (LLM) | A topic like "ignore instructions…", or Gemini returning malicious or off-format content | Topic passed as JSON data, with length and charset caps. zod validation of output. Admin review before saving. Rendered as text (no `dangerouslySetInnerHTML`) | Unit: invalid AI JSON is rejected (502) |
| T14 | XSS | A player name like `<script>` shown on the admin panel or projector | React escaping everywhere. Name validated (letters, spaces, `.-'`, 2–40). CSP header | Unit: validator rejects it. No `innerHTML` in the code (lint rule) |
| T15 | Information disclosure | Secrets leaking into the client bundle or the repo | Only `NEXT_PUBLIC_*` reach the client. `server-only` imports. `.env*` git-ignored. Service role never in Vercel | `scripts/check-bundle-secrets.mjs` after a build: the real secret values and secret-shaped tokens must appear in no client file and no tracked file |
| T17 | Spoofing / DoS | Someone registers another student's USN first ("squatting"), so the real student can't join | USN is unique per game. The admin can remove a registration to free the USN and reset a player's PIN (P4, T-4.1 / T-4.2). Physical check by hosts at sign-up | Integration: duplicate USN → `DUPLICATE_USN`; admin removal frees it (P4) |
| T16 | Cheating (out of band) | Looking up an answer on a second phone or another app | Fullscreen, copy/select blocked, watermark, alerts for leaving the site (`visibilitychange`/`blur`/`pagehide`), timer. **A second device cannot be detected.** The physical game hosts watch for it | Unit: the focus guard fires on visibility change |
| T18 | Information disclosure | The projector shows who answered right or wrong before the host decides | `stage_seats` holds only `seated` until the admin calls `reveal_results` (admin-only RPC); the table is public read-only (names and seat states, no answers) and written only by security-definer SQL | Integration (`stage.test.ts`): seated on scan, still hidden at judging, green/red only after an admin reveal; players and anonymous visitors can't write seats; simulation checks it every spin |

## Authentication and authorization

- **Players:**
  - Supabase Auth with email/password. The email is synthetic (`<usn>@players.aimusicalchair.app`) and the password is a 6-digit PIN.
  - Accounts are created by the `player-signup` Edge Function (D-015): pre-confirmed, so no email is ever sent and browser sign-up stays unused. The function validates USN and PIN, only creates accounts, and runs with the service key that Supabase injects (never stored in Vercel or the repo).
  - A chair link opened outside the game (`/c/<id>?k=…`) is redirected to `/c/<id>` so the secret doesn't stay in the page or browser history.
  - Sessions are kept in `@supabase/ssr` cookies (httpOnly where server-set), never in custom localStorage tokens.
  - `register_player` links `auth.uid()` to a `players` row.
- **Admins:**
  - Supabase Auth email + strong password. Created by hand and listed in `admins`.
  - `is_admin()` is a `security definer` SQL function, `stable`, with `search_path = ''`.
  - `/admin` routes check it on the server (middleware + layout) and redirect anyone else.
- **Screen:** public read of `public_state` only, which has no PII beyond first names. **Default: show full names.** This is an open question in the PRD; it can switch to first name + USN suffix.
- **All RPCs:**
  - `security definer`, `set search_path = ''`, fully qualified names;
  - `revoke execute … from public, anon`, then grant only to `authenticated`;
  - each one checks the role itself.

## Secrets

- `GEMINI_API_KEY` is server-only (route handler), stored in Vercel encrypted environment variables.
- **Vercel environment, audited 2026-10-17:**
  - The app needs only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` and `GEMINI_API_KEY`. All are present and match local.
  - The `TEST_SUPABASE_*` variables (test project secret key) were removed from Vercel; they belong only in local `.env.local`.
  - The Vercel–Supabase integration also injects server-only `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET` and `POSTGRES_*`. They are never exposed to browsers (no `NEXT_PUBLIC_` prefix) and are **not read by the app**. To reach full least privilege, disconnect the integration in Vercel and keep the five variables above set manually.
- `TEST_SUPABASE_SERVICE_ROLE_KEY` is used **only** by `scripts/simulate.ts` against the **aimc-test** project, from a git-ignored `.env.local`. It is never set in Vercel.
- The Spotify access token stays in the admin's browser `sessionStorage` (it is a third-party token, not our session), and it is cleared on logout.
- No secrets in code, logs or error messages. Errors return codes, not stack traces.

## Data protection

- **PII stored:** name, USN, phone, branch. Used only to run the event.
- Phone numbers are shown only to admins. Nothing is shared with third parties: Gemini receives only the admin's topic text, never player data.
- **Retention:** after the fest, the admin exports results (CSV) and runs `reset_game` + deletes players, **within 30 days**.
- Transport is HTTPS only (Vercel + Supabase). Data is encrypted at rest by Supabase.

## Third parties

| Service | Data sent | Risk control |
|---|---|---|
| Supabase | All app data | RLS, separate test and prod projects |
| Vercel | Requests and logs | No PII in logs |
| Google Gemini | Topic, difficulty, count | Server-only key, rate limit, output validation |
| Spotify | The admin's Spotify account | PKCE (no client secret), minimal scopes, token in session only |

## Security decisions

D-004 (answers secret), D-005 (chair QR rules), D-006 (anti-cheat scope). See [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md).

**Headers** (`next.config` `headers()`):
- `Content-Security-Policy`:
  - `default-src 'self'`;
  - `connect-src` self, Supabase (https + wss), `api.spotify.com`, `*.spotify.com`;
  - `script-src` self, `sdk.scdn.co`;
  - `img-src` self, `data:`, `i.scdn.co`;
  - `frame-src sdk.scdn.co`;
  - `media-src` self, `blob:`.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy: camera=(self)`.
- `X-Frame-Options: DENY`.

## Security tests

All tests run before release (`agylite verify`). They are negative-first, and each threat has at least one test:

1. **Integration tests** (`integration/security.test.ts`, `npm run test:integration`, run with real signed-in users against **aimc-test**, D-013): T1–T9, T11, T12, T14.
2. **Vitest:** input validators (names, USN, phone, CSV rows, AI output schema), QR parsing (rejects foreign URLs), focus guard behaviour, Gemini route auth (401/403/422).
3. **Simulation:** concurrent claim races (T4), deadline enforcement (T6).
4. **Build check:** no secret values in `.next/static`. `npm audit --omit=dev` shows no high or critical issues.

## Dependency audit (T-802)

- `npm audit --omit=dev --audit-level=high` must pass: no high or critical issue in anything that ships.
- Accepted, with no fixed version published (checked 2026-10-17):
  - `braces` ≤ 3.0.3 (high, GHSA-vfj7-8cjw-p6xm), through `eslint-config-next`: lint tooling only, never runs in the app or the browser.
  - `sprintf-js` ≤ 1.1.3 (moderate, GHSA-hp3w-g68c-fv3c), through `mammoth` → `argparse`: `argparse` is mammoth's command-line parser; the app only calls mammoth's library API on the server, so the vulnerable formatting path is unreachable.
