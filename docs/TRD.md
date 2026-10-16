# Technical Requirements: AI Musical Chair

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4, CSS variables as design tokens ([DESIGN.md](DESIGN.md)) |
| 3D | three, @react-three/fiber 9, @react-three/drei, @react-three/postprocessing |
| Motion | motion (Framer Motion), gsap, canvas-confetti |
| Backend | Supabase cloud: Postgres 15+, Auth, Realtime; `@supabase/supabase-js` v2, `@supabase/ssr` |
| Validation | zod |
| QR | `@zxing/browser` (scan), `qrcode` (generate) |
| CSV | papaparse |
| AI | `@google/genai` (Gemini) |
| Music | Spotify Web Playback SDK (script tag) + Web API via fetch |
| Tests | Vitest (unit), Vitest integration tests with supabase-js against aimc-test (`npm run test:integration`, D-013), `tsx scripts/simulate.mts` (end-to-end bots) |
| Tooling | npm, ESLint, Prettier, Supabase CLI (cloud only) |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). Planned folder structure:

```
src/
  app/
    page.tsx                 landing (3D chair ring, links)
    play/                    player: register, login, status, scan, question
    admin/                   login, dashboard, game, chairs, questions, players, music, spotify/callback
    screen/                  projector
    c/[chairId]/page.tsx     "scan from the website" landing
    api/questions/generate/route.ts
  components/{player,admin,screen,three,ui}/
  hooks/                     useRealtimeTable, usePublicState, useMyStatus, useFocusGuard
  lib/
    engine.ts                pure rules (+ engine.test.ts)
    supabase/{client,server,rpc,types}.ts
    ai/{prompt,schema}.ts
    spotify/{pkce,player,api}.ts
    qr.ts                    build/parse chair URLs
supabase/
  migrations/                0001_schema.sql, 0002_rls.sql, 0003_rpc.sql, 0004_realtime.sql
  seed/questions.csv
integration/                 security.test.ts, game.test.ts, harness.ts (run against aimc-test)
scripts/                     seed-questions.mts, simulate.mts
public/models/{chair,trophy}.glb
```

## Infrastructure

- Vercel (Production + Preview) and two Supabase cloud projects (`aimc-prod`, `aimc-test`). See [ARCHITECTURE.md](ARCHITECTURE.md#infrastructure).
- Supabase Auth settings:
  - email confirmation **off** (players use synthetic emails);
  - minimum password length 6;
  - default sign-in rate limits **kept**;
  - Site URL and redirect URLs set to the Vercel domains.

## APIs

### Postgres RPCs (called via `supabase.rpc`)

| RPC | Caller | Returns |
|---|---|---|
| `register_player(name, usn, phone, branch)` | Authenticated user without a player row | the player row (safe columns) |
| `my_status()` | Player | `{status, round_no, phase, my_attempt_id, locked, eliminated_in_round, final_rank}` |
| `claim_chair(chair_id uuid, secret text)` | Player | `{attempt_id, chair_number, question:{id,text,type,options}, deadline}` |
| `submit_answer(attempt_id uuid, answer text)` | Player | `{received:true}`. **Never** returns correctness |
| `report_focus_event(attempt_id uuid, kind text, away_ms int)` | Player | void |
| `start_round(difficulty int default null, timer_seconds int default null)` | Admin | round row |
| `open_scan_window()` / `close_scan_window()` / `next_spin()` | Admin | spin row |
| `end_round(force bool default false, reason text default null)` | Admin | `{eliminated:[…], finished:bool}` |
| `set_chairs_active(ids uuid[], active bool)` / `create_chairs(n int)` / `delete_chairs(ids uuid[])` / `rotate_chair_secret(id)` / `set_final_chair_count(n int)` / `mark_final_round()` | Admin | chairs |
| `override_attempt(attempt_id, correct bool, reason)` / `free_chair(chair_id, reason)` / `kick_player(player_id, reason)` / `restore_player(player_id, reason)` | Admin | updated rows |
| `start_new_game(confirm text, name text default null)` | Admin | Ends the current session (stopping any round), opens a new lobby; `confirm` must equal `'NEW GAME'`. Chairs/QR codes unchanged (D-014) |
| `remove_player(player_id, reason)` | Admin | Deletes a current-game registration (frees the USN and phone; SECURITY.md T17). Audited |
| `reset_game(confirm text)` | Admin | Clears rounds, spins, attempts and alerts, and resets players to active. `confirm` must equal `'RESET'` |

Errors are raised as `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<CODE>'`. The UI maps the codes to friendly text:
`NOT_AUTHENTICATED`, `NOT_ADMIN`, `NOT_REGISTERED`, `NOT_ACTIVE`, `ALREADY_LOCKED`, `ALREADY_SCANNED_THIS_SPIN`, `SCAN_WINDOW_CLOSED`, `CHAIR_INACTIVE`, `CHAIR_TAKEN`, `CHAIR_LOCKED`, `BAD_QR`, `ALREADY_ANSWERED`, `INVALID_TRANSITION`, `ROUND_NOT_COMPLETE`, `REGISTRATION_CLOSED`, `DUPLICATE_USN`, `DUPLICATE_PHONE`, `VALIDATION`.

### Edge Function

- `player-signup` (Supabase Edge Function, `supabase/functions/player-signup`, deployed with `--no-verify-jwt`)
  - Body: `{usn, pin}`. Returns 200 `{status: "created" | "exists"}`, 422 `{code: "VALIDATION"}`, 500 `{code: "SERVER"}`.
  - Creates a pre-confirmed auth user (D-015). The browser then signs in with USN + PIN and calls `register_player`.
  - CORS allows any origin: it isn't a security boundary for this endpoint (it only creates pre-confirmed accounts from valid input), and it lets the Vercel domain and previews work without configuration.
  - Deploy: `supabase functions deploy player-signup --use-api --no-verify-jwt --project-ref <ref>`.

- `admin-reset-pin` (Edge Function, `--no-verify-jwt`): body `{playerId, pin}` with the admin's access token.
  - Verifies the caller is signed in and listed in `admins`, then sets the player's password to the new 6-digit PIN.
  - Audited. Returns 200 `{status: "updated"}`, or 401 / 403 / 404 / 422.

### Admin console routes

- `/admin/login`: email + password. Signs out again immediately if the account isn't in `admins`.
- `/admin` (Game), `/admin/chairs` (+ `/print`), `/admin/players`, `/admin/settings`.
  - All sit under the `(console)` route group, whose server layout redirects non-admins (SECURITY.md T8).
- Data comes from `loadAdminData()` (`src/hooks/useAdminData.ts`): admin-only RLS reads, re-run when Realtime reports a change on `public_state`, `spins`, `chairs`, `attempts`, `players`, `alerts` or `game_sessions`.

### Question bank routes (P5)

- `POST /api/questions/extract` (multipart `file`, optional `difficulty`, `topic`): accepts PDF, DOCX, PNG/JPG/WEBP, TXT/MD, CSV up to 4 MB.
  - CSV in our own column format imports directly without the AI.
  - Every other file goes to Gemini: PDFs and images as file parts, DOCX converted to text with mammoth, text wrapped in `<material>` delimiters. Gemini returns drafts.
- `POST /api/questions/generate` `{topic, difficulty, count ≤ 50, type: mcq | one_word | mixed}` returns drafts.
- Both routes are admin-only (401/403) and refuse cross-site origins (403).
- Rate limit: `log_ai_request` RPC, 10 requests per admin per minute (429). Returns 503 when `GEMINI_API_KEY` is missing, 502 on unusable model output, 504 after 50 s.
- Model output is untrusted: `validateDrafts` repairs common slips (option letter as the answer, case, difficulty range), validates with the CSV schema, removes duplicates and caps at 100.
- Drafts are saved only after admin review, via `import_questions(questions jsonb, source)`. Duplicates (case-insensitive unique index) and invalid rows are counted, not fatal.
- Models: `GEMINI_MODEL` (optional) is tried first, then the chain `gemini-flash-latest` → `gemini-3-flash-preview` → `gemini-flash-lite-latest`.
  - The next model is tried on 404 (retired), 429 (free-tier quota) or 5xx (overloaded). The whole request times out at 55 s.
  - Quota exhaustion shows the admin "AI_QUOTA".
- **Live eval (2026-10-16, `integration/ai-live.test.ts`):**
  - Generate 10 mixed questions: 10/10 valid, 8.5 s.
  - Extract from a 5-question text paper: 4/4 correct answers, with the ambiguous question skipped, 8.6 s.
  - Prompt-injection paper: only the 2 real questions returned, the injected instruction ignored.
  - In these runs the primary model was over quota (429) and the fallback served the requests.
  - Cost: free tier; a request is roughly 1–3k tokens.
- Handler logic lives in `src/lib/ai/handlers.ts` with injected dependencies (unit-tested); the route files only wire in Supabase and Gemini.

### HTTP route

- `POST /api/questions/generate`
  - Body: `{topic: string(2..80), difficulty: 1..5, count: 1..25, type: 'mcq'|'one_word'}`.
  - Returns 200 `{drafts: Question[]}`. Errors: 401/403 (not admin), 422 (validation), 502 (AI output invalid), 504 (timeout).
  - Rate limit: 10 requests per minute per admin, counted in the `ai_requests` table.

## Database

| Table | Key columns | Notes |
|---|---|---|
| `admins` | `user_id` pk → auth.users | Membership defines `is_admin()` |
| `games` | `id`, `name`, `status`, `registration_open`, `final_chair_count` (3), `timer_seconds` (30), `auto_open_on_pause` | Exactly one row (single active game) |
| `game_sessions` | `id`, `number` unique, `name`, `started_at`, `ended_at` | One per team's game (D-014). `games.current_session_id` points at the live one |
| `players` | `id`, `session_id`, `user_id` (unique per session), `name`, `usn` and `phone` (unique per session), `branch`, `status`, `eliminated_in_round`, `final_rank`, `created_at` | `status ∈ active, eliminated, winner, spectator, kicked` |
| `chairs` | `id`, `number` unique, `secret` (24 random bytes, base64url), `is_active` | Players can't read `secret` (no select policy) |
| `rounds` | `id`, `number`, `chair_count`, `difficulty`, `timer_seconds`, `status`, `started_at`, `ended_at` | |
| `spins` | `id`, `round_id`, `number`, `phase`, `scan_opened_at`, `closed_at` | |
| `attempts` | `id`, `spin_id`, `round_id`, `chair_id`, `player_id`, `question_id`, `scanned_at`, `deadline`, `answered_at`, `answer`, `result`, `time_ms` | unique `(spin_id, chair_id)`, unique `(spin_id, player_id)`; `result ∈ pending, correct, wrong, timed_out` |
| `questions` | `id`, `text`, `type`, `options jsonb`, `answer`, `alternatives text[]`, `difficulty`, `topic`, `source`, `is_enabled` | Players have no select policy |
| `alerts` | `id`, `player_id`, `attempt_id`, `kind`, `away_ms`, `acknowledged`, `created_at` | |
| `public_state` | `id=1`, `data jsonb`, `event_seq bigint`, `updated_at` | Anyone can read. Written only by RPCs |
| `admin_audit` | `id`, `admin_id`, `action`, `target`, `reason`, `at` | Insert-only |
| `ai_requests` | `admin_id`, `at` | Rate limiting |

- **Derived state:** a chair is locked in round R if it has `attempts.result = 'correct'` in R. The view `v_round_chairs` is admin-only.
- **Indexes:** `attempts(round_id, result)`, `attempts(player_id, round_id)`, `questions(difficulty) where is_enabled`.
- **Answer matching:**
  - MCQ: compares the option index.
  - One word: `lower(trim(unaccent(answer)))` against the answer plus alternatives.

## Integrations

- **Spotify:**
  - Client ID is public (`NEXT_PUBLIC_SPOTIFY_CLIENT_ID`). Redirect is `${SITE_URL}/admin/spotify/callback`.
  - The admin's Spotify account must be added under the developer app's "Users and access" while the app is in development mode.
- **Gemini:**
  - Model is set by `GEMINI_MODEL`, defaulting to a current Flash model.
  - `responseMimeType: application/json` with `responseSchema`. Timeout 30 s.
- **Blender MCP:** development only. GLB exports are under 1 MB each, Draco-compressed, and committed to `public/models/`.

## AI/LLM system

- Used only for **authoring questions**, never during gameplay.
- **Prompt:** a fixed system instruction (role: quiz writer for engineering students; rules: one unambiguous correct answer, no trick questions, options of similar length, difficulty rubric 1–5). User content: topic, difficulty, count and type as JSON.
- **Output contract:** zod schema `{text ≤ 200 chars, type, options? (2–6, ≤ 60 chars each), answer, alternatives?, difficulty, topic}`. For MCQ, the answer must be one of the options. Duplicates of existing questions (normalized text) are dropped.
- The admin always reviews before saving. AI questions are marked `source='ai'`.

## Runtime

- **Player pages:**
  - First-load JS for `/play` is ≤ 250 KB gzipped (target), and three.js is not loaded on the scanner or question screens.
  - The status screen loads 3D lazily (`dynamic(..., {ssr:false})`) at low quality.
- **Realtime:** one channel per client. Player subscribes to `public_state` (+ refetches `my_status` on change). Admin subscribes to `public_state`, `attempts`, `alerts` and `players`. Screen subscribes to `public_state`.
- Server time is the authority. The client shows countdowns from `deadline` corrected by a time offset measured on login (`select now()`).

## Deployment

1. `supabase link --project-ref <aimc-prod>`, then `supabase db push`. Repeat for `aimc-test`.
2. Create the admin account in each project:
   - Supabase dashboard → **Authentication → Users → Add user**: email + strong password, **Auto Confirm User** on.
   - Then in **SQL Editor** run: `insert into public.admins (user_id) select id from auth.users where email = '<admin email>';`
3. Set the Vercel environment variables, then `vercel --prod` (or Git integration).
4. Rehearsal: run `scripts/simulate.ts` against `aimc-test`, then a real-phone dry run on Preview.
5. Event day: `reset_game('RESET')` on prod, open registration, then show the join QR.

## Environment variables

| Name | Where | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Vercel | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | No (public key; RLS enforces access) |
| `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` | Local `.env.local` only (tests and simulation against **aimc-test**) | No |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Only the local `.env.local` for `scripts/simulate.ts` against **aimc-test** | **Yes**. Never in the Vercel app or the client |
| `GEMINI_API_KEY` | Vercel (server) | **Yes** |
| `GEMINI_MODEL` | Vercel (server) | No |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Vercel | No |

`.env.local` is git-ignored. `.env.example` lists the names without values.

## Dependencies

Runtime: `next react react-dom @supabase/supabase-js @supabase/ssr zod three @react-three/fiber @react-three/drei @react-three/postprocessing motion gsap canvas-confetti @zxing/browser qrcode papaparse @google/genai server-only`.

Dev: `typescript @types/* vitest tsx eslint prettier tailwindcss`.

- Each is pinned to an exact version in `package-lock.json`.
- `npm audit --omit=dev` runs before the release.
- No new dependency is added without a recorded reason.
