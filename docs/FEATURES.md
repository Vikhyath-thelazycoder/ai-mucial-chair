# Features: AI Musical Chair

The feature catalogue. Phases refer to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Feature list

| ID | Feature | Description | Phase | Status |
|---|---|---|---|---|
| F1 | Player registration and login | Join by QR code, register with name/USN/phone/branch/PIN, session saved in the browser | P3 | DONE |
| F2 | Live player status | Waiting / Music / SCAN NOW / Locked in / Standing / Eliminated, updated in real time | P3 | DONE |
| F3 | In-site chair scanner | Camera QR scanner inside `/play`, the only way to claim a chair | P3 | DONE |
| F4 | Randomized questions | A random unseen question per scan at the round's difficulty, MCQ or one word | P2–P3 | DONE |
| F5 | Answer timer | Countdown set by the admin per round; the server enforces the deadline | P2–P3 | DONE |
| F6 | Anti-cheat | Fullscreen, no copy/select, watermark, alerts when the player leaves the site | P3 | DONE |
| F7 | Chair QR generator | Create chairs, toggle active/inactive, print a QR sheet with big chair numbers | P4 | DONE |
| F8 | Live chair map | Each chair tile shows the player's name, USN, phone, question, answer, ✅/❌ and time | P4 | DONE |
| F9 | Game console | Start round → music → scan window → judging → next spin / end round → set chairs | P4 | DONE |
| F10 | Admin dashboard and alerts | Counts, answered this spin, fastest times, live anti-cheat alert feed | P4 | DONE |
| F11 | Player management | List, search, status, kick, manual overrides | P4 | DONE |
| F12 | Question bank | Manual add/edit, CSV import, difficulty 1–5, topics | P5 | DONE |
| F13a | Upload any question file | PDF, Word, photo, text or CSV → Gemini extracts questions and answers → review → save | P5 | DONE |
| F13 | Gemini question generation | Generate by topic, difficulty and count, then review before saving | P5 | DONE |
| F14 | Spotify music control | Log in, search, playlist, play/pause/skip/volume; pause can open the scan window | P6 | DONE (live Spotify check pending) |
| F15 | Projector screen | Live 3D scene, SCAN NOW splash, round-over and elimination animations, 3D podium | P7 | DONE |
| F17 | New game (next team) | Admin ends the current game; the next team registers fresh; all chairs are removed so the host sets new ones (numbered from 1, new QR codes) | P2, P4 | DONE |
| F16 | Bot simulation | A script plays a full game against cloud Supabase with N bots | P8 | DONE |

## Feature details

### F1 · Player registration and login
- **Behaviour:**
  - The join QR opens `/play`.
  - Registration asks for name (2–40 chars), USN (unique, uppercase, matching the pattern `^[0-9A-Z]{6,12}$`), phone (10 digits, unique), branch and a 6-digit PIN.
  - Login uses USN + PIN. The session is stored in Supabase Auth cookies.
- **Acceptance:**
  - A duplicate USN or phone is rejected with a clear message.
  - Wrong PINs are rate-limited.
  - A logged-in player reopening the link goes straight to the status screen.
  - Registration can be closed by the admin.
- **Edge cases:**
  - A player who registers after the game has started joins as `active` only while the game is in the lobby. Otherwise they become a `spectator`.

### F2 · Live player status
- **Behaviour:** the player subscribes to the public game state and their own row. Possible states:
  - `WAITING` (lobby or between rounds)
  - `MUSIC` (walk!)
  - `SCAN_NOW` (scan window open and the player is eligible)
  - `ANSWERING`
  - `SUBMITTED` (waiting for the admin)
  - `LOCKED_IN` (shown only as "Stay seated", never "Correct")
  - `STANDING`
  - `ELIMINATED`
  - `WINNER`
- **Acceptance:**
  - The screen updates within 1 s of an admin action.
  - It never displays correct/wrong.
- **Note:** after judging, "Stay seated" and "Stand up" reveal the result indirectly, and the admin calls those players up anyway. This is intended: the result is revealed when the admin judges, not when the player submits.

### F3 · In-site chair scanner
- **Behaviour:**
  - The scanner opens automatically when the music stops (no extra tap) and uses the rear camera with @zxing/browser and decodes `https://<host>/c/<chairId>?k=<secret>`.
  - It calls `claim_chair`, and the question appears immediately.
  - If someone opens the chair URL directly in a camera app, they see "Scan this from the AI Musical Chair website" and nothing is recorded.
- **Acceptance:**
  - A scan works only when the player is logged in, active, not locked, and the scan window is open.
  - The chair must be active, not locked, and not claimed this spin.
  - Each case fails with a specific friendly message.

### F4 · Randomized questions
- **Behaviour:** the server picks a random question with `difficulty = round.difficulty` that this player hasn't seen yet in this game. If none are left, it uses the closest difficulty.
- **Acceptance:**
  - The answer is never in any response sent to the player.
  - No player sees the same question twice in one game, while enough questions exist.

### F5 · Answer timer
- **Behaviour:**
  - The deadline is `scanned_at + timer_seconds`.
  - The client shows a countdown. The server rejects answers that arrive after the deadline plus a 2 s network grace.
  - An answer that never arrives counts as wrong once the deadline passes.
- **Acceptance:** a late submission is stored as `timed_out` and counts as wrong.

### F6 · Anti-cheat
- **Behaviour:**
  - While answering, the site requests fullscreen.
  - Text selection, copy, cut, paste, the context menu and long-press are blocked.
  - The player's name and USN appear as a watermark.
  - `visibilitychange`, `blur` and `pagehide` show a full-screen warning and call `report_focus_event(away_start)`. Coming back reports `away_end` with the time away.
- **Acceptance:**
  - The admin sees "⚠ <name> (Chair 7) left the site, 6.2 s" within 2 s.
  - The penalty is the admin's decision (they can mark the answer wrong).

### F7 · Chair QR generator
- **Behaviour:**
  - Any number of chairs: the admin can add more or delete any chair at any time between spins. Numbering continues from the highest number.
  - The admin creates N chairs, numbered sequentially, each with a random 24-byte secret.
  - Chairs can be toggled active/inactive and their secret can be regenerated.
  - The print view uses an A4 grid. Each card has the QR code, a **huge chair number**, and the game name and logo.
- **Acceptance:**
  - Inactive chairs can't be claimed.
  - Regenerating a chair's secret makes its old QR code invalid.

### F8 · Live chair map
- **Behaviour:** a grid of active chairs. Each tile shows:
  - empty, claimed (name, USN, phone, scan time), answered (answer, ✅/❌, time in ms), or locked;
  - a highlighted ⚠ when an alert is open.
- **Acceptance:** the tile updates within 1 s of a scan or answer.

### F9 · Game console
- **Behaviour:** a state-machine bar with only valid actions enabled. See [SYSTEM_WORKFLOW.md](SYSTEM_WORKFLOW.md) for the flow.
- **Acceptance:**
  - Invalid transitions are rejected by the server, not just hidden in the UI.
  - "End round" is enabled only when all chairs are locked, unless the admin uses a confirmed override.

### F10 · Admin dashboard and alerts
- Shows registered, active, eliminated and spectator counts; answered/claimed this spin; the fastest correct times this round; and the live alert feed with an acknowledge button.

### F11 · Player management
- Players can be searched by name or USN.
- Admin actions are kick (eliminate with reason), restore, mark an attempt correct or wrong (logged), and free a chair.
- Every override is written to `admin_audit`.

### F12 · Question bank
- **Fields:** text, type (`mcq` | `one_word`), options (MCQ, 2–6), answer, accepted alternative answers (one word), difficulty 1–5, topic.
- **CSV columns:** `text,type,options(pipe-separated),answer,alternatives(pipe-separated),difficulty,topic`. Invalid rows are reported with row numbers and are not imported.

### F13 · Gemini question generation
- **Behaviour:**
  - The admin picks a topic, difficulty, count (≤ 25) and type.
  - The server calls Gemini with a strict JSON schema, then validates and deduplicates the result.
  - The admin reviews and edits a draft table and saves the rows they choose.
- **Acceptance:**
  - Nothing is saved without the admin's review.
  - Malformed AI output is rejected with an error message.
  - The key is never sent to the browser.

### F14 · Spotify music control
- **Behaviour:**
  - The admin logs into Spotify (PKCE), and the Web Playback SDK creates a "AI Musical Chair" device in the browser.
  - Search, playlists, queue, play/pause/skip and volume are available.
  - When "Pause opens scan window" is on, pausing triggers `open_scan_window`.
  - There is always a manual "Music stopped" button.
- **Acceptance:**
  - The game works even if Spotify fails, using the manual button.
  - The Spotify token stays in the admin's browser session only.

### F15 · Projector screen
- **Behaviour:** `/screen`, read-only, opened from the admin panel's Projector link (the main site link goes to the admin login), shows:
  - a header with TECHVIDYA, AI Musical Chair and Sai Vidya Institute of Technology, plus only the round number and the number of chairs;
  - a realistic 3D ring with exactly the admin's active chairs, each with its seat number on a plate behind it;
  - the moment a player scans a chair, a realistic seated person appears on it with their name floating above;
  - when the admin presses **Show results on projector**, right answers light green and wrong ones red; on the next spin the wrong players stand up and leave, the green ones stay;
  - a music visualizer, the SCAN NOW splash, "Round N over" with eliminated names, a "Final round" sting, and a 3D podium with confetti.
- **Acceptance:**
  - It never shows right or wrong until the admin reveals that spin, and never shows answers or questions.
  - It shows no join QR code (that stays on the admin panel).
  - It fills the screen at any aspect ratio and recovers its state on reload.

### F16 · Bot simulation
- `scripts/simulate.ts` creates N bot players in a test game on cloud Supabase. It drives a full game through the same RPCs with random right or wrong answers, checks the invariants, and deletes the bots.

### F17 · New game (next team)
- **Behaviour:**
  - The admin's **New game** button asks for typed confirmation ("NEW GAME"), then calls `start_new_game`.
  - Anything still running is stopped: unanswered attempts count as timed out and the round is closed.
  - The current game is archived as a session, and a fresh lobby opens with registration on.
  - Every chair is removed (soft delete, so past results keep their chair). The new game starts with zero chairs; chairs added next are numbered from 1 and get new QR codes (D-022).
  - The previous team's phones show "A new game has started" with an option to register again.
- **Acceptance:**
  - The previous team can't scan (`NOT_REGISTERED`).
  - After New game there are no chairs; the old printed chair QR codes stop working (`BAD_QR`).
  - Chairs added in the new game start again at number 1.
  - The same USN can register again in a later game.
  - Old results are kept.
  - Only admins can start a new game.
