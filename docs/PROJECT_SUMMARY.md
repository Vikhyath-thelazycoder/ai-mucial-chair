# AI Musical Chair: what's been built

A live game for **Techvidya** at **Sai Vidya Institute of Technology**: musical chairs where you only keep your chair if you answer a quiz question correctly on your phone, fast.

- **Live site:** https://ai-mucial-chair.vercel.app (opens the admin login)
- **Code:** GitHub `Vikhyath-thelazycoder/ai-mucial-chair`, branch `main`
- **Status:** all 8 phases built and tested. Waiting on three hands-on steps by the organisers (see [What's left](#whats-left)).

## How a game works

1. Students scan the **join QR** and register on their phones (name, USN, phone, branch, 6-digit PIN).
2. The host starts a round. **Music plays**; players walk around the chairs.
3. The music stops (Spotify pause or the **Space** key). Phones open the camera by themselves: **SCAN NOW**.
4. Each player sits and scans the QR on their chair. The phone shows a random question; the projector shows a person sitting in that chair with the player's name.
5. The host closes the scan window (**J**), checks the answers, and presses **R** to show results: **green** for right, **red** for wrong.
6. Next spin (**N**): red players stand up and play again for the free chairs; green players stay seated. Repeat until every chair is green.
7. End the round (**E**): everyone without a chair is out. Remove chairs and play the next round.
8. The **final round** crowns the chair holders; fastest correct answer wins. Podium with trophy and confetti on the projector.
9. **New game** for the next team: chair QR codes stay the same.

## The three screens

| Screen | Who | What it does |
|---|---|---|
| **Player** (`/play`) | Every student, own phone | Register / log in, live status (waiting, walk, SCAN NOW, locked in, out, winner), in-site QR scanner, question with countdown, anti-cheat |
| **Admin** (`/admin`) | Host, laptop | Game console with shortcuts, live chair map, chairs and QR printing, players, questions (with AI), music, settings |
| **Projector** (`/screen`) | The hall | Realistic 3D stage of the whole game; opened from the admin's **Projector ↗** link |

## Everything that's built

### Player site
- Registration and login with USN + 6-digit PIN; returning players log straight back in.
- Live status that updates within a second of the host's actions, and recovers after a dropped connection.
- In-site QR scanner (the only way to claim a chair); scanning a chair QR with a normal camera app does nothing.
- Random, unseen question per scan at the round's difficulty (multiple choice or one word), with a server-enforced timer.
- Anti-cheat: fullscreen, copy/select blocked, name watermark, and an alert to the host if a player leaves the screen while answering.
- Late registration still plays round 1; after that, only chair holders continue.

### Admin console
- **Game console:** Start round, Music stopped (Space), Close scan & judge (J), **Show results on projector (R)**, Next spin (N), End round (E), Force end with a reason.
- **Live chair map:** who scanned each chair, their question and answer, right/wrong, answer time, anti-cheat flag, and result overrides (reason required, audited).
- **Chairs & QR:** create any number of chairs, switch them on/off between rounds, rotate secrets, print a 2-per-A4 QR sheet with big chair numbers.
- **Players:** search, statuses, remove a registration (frees a USN), reset a PIN.
- **Questions:** add/edit by hand, CSV import, **upload any file** (PDF, Word, photo, text, CSV) and Gemini extracts the questions, or **generate with Gemini** by topic/difficulty; nothing is saved without the host's review.
- **Music:** Spotify login, in-browser player, search, playlists, queue, play/pause/skip/volume; "pause opens the scan window" switch; Spotify status shown on every admin page.
- **Settings:** game name, timer, final-round size, registration open/closed, **Spotify check** (account, devices, test song), Restart this game, New game.

### Projector (`/screen`)
- Header: **TECHVIDYA · AI MUSICAL CHAIR · Sai Vidya Institute of Technology**, the round number and the number of chairs.
- A ring of **realistic 3D chairs** (walnut and leather, made in Blender), one per active chair, each with its **seat number**.
- A **realistic seated person** (Blender, CC0 base mesh, dressed in a T-shirt, jeans and sneakers) appears the moment a player scans, with their **full name** floating above; every player keeps their own shirt colour.
- **Green / red lights** only after the host presses Show results; red players stand up and leave on the next spin.
- Names never overlap each other or the SCAN NOW / WALK! / results band; checked at 1920×1080 and 1280×800 with 25 seated players.
- **Drag with the mouse** to rotate around the ring or look from higher/lower; every chair always stays in view.
- Music visualizer, SCAN NOW splash, "Round N over" with eliminated names, "Final round" sting, **3D podium** with a rising trophy and confetti.
- Reloading the projector never replays an animation; it comes back to the live state.

### Behind the scenes
- **Next.js 15** on **Vercel**; **Supabase** (Postgres, Auth, Realtime). Every game rule runs inside the database, so a phone can't cheat by calling the server directly.
- Two databases: **live** for the fest and **test** for bots and rehearsals.
- Security: no answers ever reach a phone; strict row-level security; chair QR codes carry a random secret; Content-Security-Policy and security headers; secrets never in the browser.

## How it was tested

| Test | Result |
|---|---|
| Unit tests (rules, view logic, layout, models, Spotify, AI) | 253 passing |
| Database tests against the test project (real accounts per role) | 70 passing |
| **Bot stress test:** 30 bots + admin bot, 5 full games, random chair add/delete | **5/5 green, 1,650 rule checks**; chair claims typically ~60–80 ms |
| **Demo video:** one real 30-player game, admin + projector + phone side by side | `demo/ai-musical-chair-demo.mp4` (local file, 10 min 39 s); the phone player won |
| Security pass (every threat in SECURITY.md) | All passing; no secrets in the browser or repo; no high/critical issue in production dependencies |
| Projector layout (25 seated players, two screen sizes) | No overlapping or hidden names |
| WiFi sign-in burst (35 phones, one network) | 30 in, 5 blocked: **the live sign-in limit must be raised** |

Details: [reports/TEST_REPORT.md](reports/TEST_REPORT.md), [reports/simulation.md](reports/simulation.md), [reports/wifi-signin.md](reports/wifi-signin.md).

## What's left

These need a person, not code:

1. **Raise the sign-in limit (must do).** Supabase dashboard → live project → Authentication → Rate Limits → *Sign-ups and sign-ins* → **300**. At the default (30 per 5 minutes per network), the 31st student on campus WiFi can't join.
2. **Real-phone rehearsal** on the live site with volunteers: follow [REAL_DEVICE_TEST.md](REAL_DEVICE_TEST.md) (19 steps, iPhone and Android, campus WiFi) and note any issues.
3. **Spotify on the projector laptop:** add the redirect URI and the Premium account in the Spotify developer dashboard, then Settings → Spotify check → Play test song.
4. **Sign off** [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) (admin accounts, chairs printed, questions loaded, projector laptop ready).

## Where to find things

| Document | What's in it |
|---|---|
| [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) | Go-live setup, rehearsal, event-day runbook, what to do if something breaks, sign-off |
| [REAL_DEVICE_TEST.md](REAL_DEVICE_TEST.md) | Step-by-step real-phone test on the live site, with an issue log |
| [reports/TEST_REPORT.md](reports/TEST_REPORT.md) | All Phase 8 test results |
| [FEATURES.md](FEATURES.md) | Every feature and its acceptance criteria |
| [PRD.md](PRD.md) · [TRD.md](TRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) | Product, technical and architecture specs |
| [SECURITY.md](SECURITY.md) | Threat model, the test for each threat, accepted risks |
| [DESIGN.md](DESIGN.md) | Look and feel, colours, motion, accessibility |
| [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) | Every major decision and why |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | All phases and tasks with their status and evidence |

| Script | What it does |
|---|---|
| `scripts/simulate.ts` | Bot stress test on the test database |
| `scripts/record-demo.ts` | Records the split-screen demo video |
| `scripts/check-screen-layout.ts` | Measures projector name tags for overlaps |
| `scripts/signin-burst.ts` | WiFi sign-in limit check |
| `scripts/check-bundle-secrets.mjs` | Makes sure no secret reaches the browser |
