# Phase 8 test report: AI Musical Chair

For the organisers of the Techvidya game at Sai Vidya Institute of Technology. Everything here ran against the **test** database (`yirhdf…`); the live game was never touched.

## Summary

| Area | Result |
|---|---|
| Bot stress test (30 bots + admin bot, 5 full games) | **5/5 runs green, 1,650 rule checks** (run 1: 25 → 15 → 8 → 3; runs 2–5 random, with chairs added/deleted) |
| Demo video (admin + projector + phone, one real game) | Recorded: `demo/ai-musical-chair-demo.mp4`, 10 min 39 s, 1920×1080; 349 rule checks passed; the phone player won |
| Security pass (SECURITY.md T1–T18) | All threat tests green; no secrets in the browser build or the repo; no high/critical issue in production dependencies |
| WiFi sign-in (35 phones, one network) | **30 signed in, 5 blocked** by Supabase's default limit → must be raised on the live project ([wifi-signin.md](wifi-signin.md)) |
| Release checklist | [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md), waiting for your sign-off |

## 1. Bot stress test (T-801)

`scripts/simulate.ts` creates 30 bot players and an admin bot, then plays complete games through the same server calls the app uses:

- Run 1 follows the planned schedule **25 → 15 → 8 → 3 chairs**; runs 2–5 use random schedules, and between rounds the admin bot deletes and adds chairs like a host would.
- Bots race for chairs at the same moment (several on one chair), answer right ~70% of the time, wrong otherwise, and ~5% never answer (counted as wrong when the window closes).
- After every step the script checks the rules: one winner per contested chair; a scan seats the player on the projector at once; **no red on the projector before the admin presses Show results**; green seats = locked chairs and red seats = wrong answers after the reveal; red players leave and green stay on the next spin; survivors are exactly the chair holders; the final round crowns exactly its chair count with ranks 1..n.

Per-run numbers (rounds, spins, collisions, right/wrong, claim latency): [simulation.md](simulation.md). Under the 30-bot race a chair claim typically took 57–74 ms (median per run), 95th percentile 150–430 ms, worst 666 ms on the first, busiest spin.

## 2. Demo video

`demo/ai-musical-chair-demo.mp4` (git-ignored; 60 MB). One real 30-player game, 25 → 15 → 8 → 3 chairs, recorded side by side:

- **Top left — admin console**, driven through its real buttons and shortcuts (Start round, Space, J, R, N, E).
- **Bottom left — projector** (`/screen`): numbered chairs, a seated person with the name the moment someone scans, green/red after Show results, red players standing up on the next spin, round stings and the podium.
- **Right — a player's phone** ("Ananya Rao"): registers through the real form, then scans chair 1 with the **real scanner** (Chromium's fake camera shows that chair's QR code) and answers on screen. She finished first.
- **Far right — captions** narrating each step.

How it was made: `scripts/record-demo.ts` builds the app against the test database, records four headless Chrome windows, and joins them with ffmpeg. The 29 other players are the same bots as the stress test.

## 3. Security pass (T-802)

- Every threat in SECURITY.md has a test, and all pass: reading answers or other players' data, scanning without registering or before the music stops, forged QR codes, double claims, late or repeated answers, players calling admin functions, anti-cheat spam, audited overrides, script-tag names, and the new T18 (the projector can't show results before the host reveals them).
- `scripts/check-bundle-secrets.mjs`: the real secret values and secret-shaped keys appear in **no** browser file and **no** tracked file.
- `npm audit`: no high or critical issue in anything that ships. Two findings have no fixed version anywhere and are accepted (written up in SECURITY.md): `braces` in lint tooling only, and `sprintf-js` inside `mammoth`'s command-line parser, which the app never uses.

## 4. WiFi sign-in check (T-8.1)

35 phones signed in at the same moment from one network: **30 got in, 5 were refused** ("Request rate limit reached"). Supabase allows 30 sign-ups + sign-ins per IP per 5 minutes by default, and every phone on campus WiFi shares one IP.

**Action for you (live project):** Supabase dashboard → Authentication → Rate Limits → *Sign-ups and sign-ins* → at least **300 per 5 minutes**. Details: [wifi-signin.md](wifi-signin.md).

## 5. What's left for you

1. Raise the sign-in limit on the live project (section 4).
2. Work through [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) and sign it off, including a real-phone rehearsal on the campus WiFi.
3. Run the Spotify check in Settings on the projector laptop with the Premium account (T-6.1).
