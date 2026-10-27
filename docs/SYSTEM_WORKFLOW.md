# System Workflow: AI Musical Chair

How the system behaves from each actor's action down to the data. Rules come from [PRD.md](PRD.md#game-rules-source-of-truth).

## Game state machine

```
            ┌──────────┐ start_round(X chairs)  ┌───────────────────────────── round ─────────────────────────────┐
  LOBBY ───▶│ in_round │───────────────────────▶ spin n: MUSIC ──open_scan_window──▶ SCAN_OPEN ──close_scan_window──▶ JUDGING
            └──────────┘                         ▲                                                                     │
                                                 └──────────── next_spin (some chairs not locked) ◀────────────────────┤
                                                                                                                       │ all chairs locked
                                                               end_round: eliminate standing ──▶ ROUND_COMPLETE ◀──────┘
                                                                                                    │
                          set_chairs(next X) + start_round ◀── (X > 3) ─────────────────────────────┤
                                                                                                    └── (final round done) ──▶ FINISHED (podium)
```

- `games.status`: `lobby` → `in_round` → `round_complete` → (`in_round` …) → `finished`
- `spins.phase`: `music` → `scan_open` → `judging` → `closed`
- Every transition is a server RPC that checks the current state, so the client cannot skip steps.

## User action → backend behavior

| Actor | Action | RPC / endpoint | Server checks | Effect |
|---|---|---|---|---|
| Player | Register | Supabase `auth.signUp` + `register_player` | Registration open, USN and phone unique, input valid | `players` row (`active` in lobby, `spectator` otherwise) |
| Player | Scan chair | `claim_chair(chair_id, secret)` | Authenticated, player `active`, not locked this round, no attempt this spin, spin `scan_open`, chair active, secret matches, chair not locked or claimed this spin | `attempts` row and a random unseen question (**no answer**) with its deadline |
| Player | Submit answer | `submit_answer(attempt_id, answer)` | Owns the attempt, not answered yet | Graded on the server. `answered_at = now()`, `time_ms = answered_at - scanned_at`, `is_correct` (false if after deadline + 2 s → `timed_out`) |
| Player | Leaves or returns while answering | `report_focus_event(attempt_id, kind, away_ms)` | Owns the attempt, rate-limited | `alerts` row, which appears in the admin feed |
| Admin | Start round | `start_round()` | Admin; status `lobby` or `round_complete`; active chairs X ≥ 1; active players > X (warns if ≤ X) | `rounds` row (difficulty = next level), spin 1 in `music` |
| Admin | Music stopped | `open_scan_window()` | Admin; spin `music` | Phase `scan_open`, `scan_opened_at = now()` |
| Admin | Close scan window | `close_scan_window()` | Admin; spin `scan_open` | Phase `judging`. Unanswered attempts past their deadline become `timed_out` |
| Admin | Next spin | `next_spin()` | Admin; phase `judging`; round not complete | Closes the current spin and creates spin n+1 in `music` |
| Admin | End round | `end_round(force bool)` | Admin; all X chairs locked (or `force` with a reason) | Unlocked active players become `eliminated` (`eliminated_in_round`). Round `complete`. If X is the final count, winners and ranks are set and status becomes `finished` |
| Admin | Add / delete / toggle chairs (any number) | `create_chairs(n)` / `delete_chairs(ids[])` / `set_chairs_active(ids[], bool)` | Admin; not during an open spin (no claims are pending) | Chairs toggled |
| Admin | New game (next team) | `start_new_game(confirm 'NEW GAME', name?)` | Admin; typed confirmation | Stops any running round (pending attempts become `timed_out`), ends the session, opens a new one in `lobby` with registration on. Every chair is soft-deleted (new game starts with zero chairs; old QR codes stop working; new chairs number from 1). Previous players get `NOT_REGISTERED` and `my_status.playedBefore = true` |
| Admin | Overrides | `override_attempt`, `free_chair`, `kick_player`, `restore_player` | Admin; reason required | Change applied and written to `admin_audit` |

## Data flow

```
 Player phone (/play) ──RPC──▶ Supabase Postgres (RPCs, RLS) ──Realtime──▶ Admin (/admin)   all tables (admin RLS)
         ▲                          │                         └──Realtime──▶ Screen (/screen)  public_state only
         └──────Realtime──────── public_state + own player row
 Admin (/admin) ──RPC──▶ game transitions        Admin ──▶ /api/questions/generate ──▶ Gemini API
 Admin (/admin) ◀──Web Playback SDK / Web API──▶ Spotify
```

- **`public_state`** is a single-row table. Every game RPC rewrites it in the same transaction. It holds:
  - game status, round number, chair count, spin number and phase, `scan_opened_at`;
  - the list of locked chairs with holder names (after judging only);
  - remaining, eliminated and winner names, plus an `event` field (`round_over`, `final`, `podium`) with a sequence number.

  Players and the screen read only this table, so they never touch the raw `attempts`.
- A player gets their own status (locked, standing, eliminated) from `my_status()`, which reads their own data.
- Realtime uses Postgres changes on `public_state` (anyone can read it), and on `attempts`, `alerts` and `players` (admin only, with RLS applied).

## Spin lifecycle (detailed)

1. **MUSIC.**
   - The admin plays Spotify. The screen shows the visualizer.
   - Players see "Music playing, walk!" and their scanner is disabled.
2. **Music stops.**
   - Either Spotify pause (with auto-open on) or the "Music stopped" button calls `open_scan_window`.
   - `public_state.phase = scan_open`, and every phone flips to **SCAN NOW** within 1 s.
3. **Scans.**
   - Seated players scan. `claim_chair` locks the chair row (`FOR UPDATE`) to settle races: the first commit wins and later ones get "Chair already taken".
4. **Answers.**
   - Each player answers within `timer_seconds`.
   - The admin's chair tile shows claimed → answered ✅/❌ with the time in ms.
5. **Judging.**
   - The admin closes the window (manually, or prompted when every claimed attempt is answered or expired).
   - Wrong and timed-out tiles are highlighted, and the admin calls those players up.
   - `public_state.locked_chairs` now includes the new correct holders. Their phones say "Stay seated", and everyone else's says "Stand up".
6. **Loop or end.**
   - If locked chairs < X, the admin starts the next spin, and only the free chairs can be claimed.
   - Otherwise the admin ends the round.

## Round end and finale

- `end_round`:
  - eliminates every `active` player without a locked chair;
  - sets `public_state.event = round_over` with the eliminated names;
  - raises the difficulty for the next round: `difficulty = min(5, round_number)`, or as set by the admin per round.
- The screen plays the GSAP "Round N over" sequence, triggered by an increase in `event_seq`.
- When the completed round's chair count is at or below the admin-set **final count (default 3)**, or the admin marked the round as final:
  - the locked players become `winner`;
  - `final_rank` is ordered by the `time_ms` of their correct attempt in that round, with an earlier `answered_at` breaking ties;
  - status becomes `finished`, and the screen plays the podium.

## AI flow

1. The admin opens Questions → Generate and enters topic, difficulty, count and type.
2. `POST /api/questions/generate`:
   - verifies the admin session and validates the input with zod;
   - calls Gemini (`responseSchema` = an array of questions) with a fixed system prompt, where the topic is passed as data;
   - validates every item with zod, drops invalid items and duplicates (normalized text), and returns drafts.
3. The admin edits and selects drafts, then inserts them into `questions` (admin RLS) with `source = 'ai'`.

## External API flow

- **Spotify:**
  - PKCE login, with a redirect to `/admin/spotify/callback`.
  - The token is kept in admin `sessionStorage` and refreshed via PKCE.
  - The Web Playback SDK creates a device and the Web API transfers playback to it. Search, playlist and player endpoints are called from the browser.
  - Failures show a toast, and the manual button stays available.
- **Gemini:** called only from the server route, with a timeout of 30 s and one retry.

## State changes summary

| Entity | States |
|---|---|
| `games.status` | lobby → in_round ⇄ round_complete → finished |
| `spins.phase` | music → scan_open → judging → closed |
| `attempts.result` | pending → correct / wrong / timed_out (overrides are logged) |
| `players.status` | active → eliminated / winner; spectator; kicked |
| `chairs.is_active` | true ⇄ false (only between spins) |

## Verification

- Vitest unit tests on `src/lib/engine.ts`: transition validity, free chairs, eligibility, round completion, elimination set, podium order.
- Integration tests (`integration/*.test.ts`, `npm run test:integration` against aimc-test, D-013) for the RPC guards and RLS, signed in as real users. Each attack from SECURITY.md is a test.
- `scripts/simulate.ts` against the cloud project plays full games with a random number of bots and random chair add/delete schedules, and checks invariants after every spin:
  - one claim per chair and per player each spin;
  - the number of locked chairs never decreases within a round;
  - eliminated players = active players − X.
