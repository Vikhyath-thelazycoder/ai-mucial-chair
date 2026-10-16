# Product Requirements: AI Musical Chair

A live tech-fest game at **Sai Vidya Institute of Technology** that mixes physical musical chairs with a quiz on players' phones.

## Problem

Classic musical chairs is decided only by who is quickest to sit. The fest wants a game that is physical, quick-thinking and fun to watch, where:
- grabbing a chair is not enough, because you must also answer a question correctly to keep it;
- the host controls everything from one panel;
- the audience follows along live on a projector.

## Target users

| User | Device | What they need |
|---|---|---|
| **Player** (student) | Own phone, any browser | Join by scanning a QR code, register once, scan their chair when the music stops, answer fast |
| **Admin / host** | Laptop (desktop Chrome) | Configure chairs and players, play music, open scan windows, see answers and times live, eliminate, run rounds |
| **Audience** | Projector (a `/screen` tab in Chrome) | See the live state, round-over animations and the final top 3 |

## Goals

1. Run a full game from registration to podium with **no manual record keeping**.
2. Players see the live game state within **≤ 1 s** of an admin action.
3. Questions are graded **only on the server**. Players never see the answer key or whether they were right.
4. A chair can be claimed by **only one registered player** per spin, and **only while the scan window is open**.
5. The admin gets an alert within **≤ 2 s** when a player leaves the site while answering.
6. Supports at least **100 registered players** and **50 chairs** in one game.

## Non-goals

- Native mobile apps or installable PWAs. This is **a website only**.
- Fully preventing screenshots or second-device cheating, which a browser cannot do. The site deters it and reports it instead.
- Points, scoring systems or a long-term player history across events.
- Payments, ticketing, or multiple games running at the same time (one active game at a time).

## Features

See [FEATURES.md](FEATURES.md). Summary:
- Player registration and login
- In-site chair QR scanner
- Randomized questions that get harder each round
- Answer timer
- Anti-cheat alerts
- Admin game console with a live chair map
- Chair QR generator and print sheet
- Spotify music control
- Question bank (manual entry, CSV import, Gemini generation)
- Projector screen with 3D animations and a podium

## Game rules (source of truth)

- The admin sets the chair count **X** (active chairs) and the game takes the registered players **Y**.
- **Who is playing (D-016):** registering doesn't put someone in the game; **sitting and scanning does**.
  - Anyone registered can play round 1, including people who register after it started.
  - The admin sees who is in play from the live scans (name, USN, chair number).
  - After round 1 only its chair holders continue. Registered people who never scanned are out of this game and are told "you can play in the next game". Later registrations are spectators.
- **One person per chair per spin:** the first scan blocks that chair's QR for everyone else in that spin. A correct answer keeps it blocked for the rest of the round. A wrong answer unblocks it for the next spin, and anyone not yet locked in may take it, including the same player.
- **Spin:**
  1. The music plays, then the admin stops it, which opens the scan window.
  2. Each seated player scans their chair's QR code inside the website and gets a random question at the round's difficulty.
  3. The player answers before the timer runs out.
- **Judging:**
  - A correct answer **locks** that chair for the rest of the round.
  - A wrong or timed-out answer frees the chair, and the player stands up.
  - Players never learn whether they were right. Only the admin panel shows it.
- **Next spin:** only the free chairs are in play. Everyone who isn't locked plays: the players who answered wrong plus those who were standing.
- **Spins repeat until all X chairs are locked** by correct answers.
- **End of round:** every player still standing is **eliminated**. The admin chooses the chair count for the next round, and the difficulty goes up.
- **The admin controls all the numbers. Nothing is fixed.** Between spins the admin can add, delete, activate or deactivate any number of chairs. Any number of players can register. The admin sets the final-round chair count (default 3) and can mark any round as the final. Numbers like "10 chairs, 15 players" in these docs are only examples.
- **New game (next team):** the admin taps **New game** to end the current game, even mid-round. That team is logged out of the game and must register again to play later. The next team registers on the same join QR, and **the printed chair QR codes stay the same for every game**. Past games' results are kept.
- **Finale:** when the final round (3 chairs) is complete, those 3 players are the winners. **The podium orders them by their correct-answer time in that final round.** Luck decides, and there are no points.

## Workflows

1. **Before the event:**
   - The admin logs in, creates chairs and prints the QR sheet (QR + big chair number).
   - The admin loads questions and connects Spotify.
2. **Joining:** players scan the join QR, open `/play`, and register (name, USN, phone, branch, PIN).
3. **Round:**
   - The admin starts the round.
   - Music plays, then stops, and the scan window opens. Players scan and answer.
   - The admin judges, calls up the players who answered wrong, and starts the next spin. This repeats until all chairs are locked.
   - The admin ends the round. The screen plays "Round N over" and eliminated names fade out.
4. **Next round:** the admin reduces the chairs, and questions get harder.
5. **Finale:** the 3-chair round completes, and the screen shows the 3D podium with confetti.

Detailed system behaviour: [SYSTEM_WORKFLOW.md](SYSTEM_WORKFLOW.md).

## Constraints

- Hosted on **Vercel + Supabase cloud** only. Nothing runs locally during the event.
- Players use **their own phones on mobile data or campus WiFi**. Pages must stay light and the 3D must fall back to 2D on low-end phones.
- Music requires a **Spotify Premium** account and the admin page open in **desktop Chrome**.
- AI question generation uses the **Gemini API** (the user's key).
- Free-tier limits: Supabase Realtime allows 200 concurrent connections, which is enough for 100 players plus the admin and screen.
- The fest date is a fixed deadline. TBD: event date.

## Success criteria

- A full rehearsal with 15+ real phones runs from registration to podium with no crashes and no manual fixes.
- The bot simulation (random player and chair counts and random chair schedules chosen per run) produces the right eliminations and podium every time.
- Every attack in [SECURITY.md](SECURITY.md) is rejected in tests: double claim, scan outside the window, unregistered scan, reading the answer, and tampering with time.

## Assumptions

- The venue has internet access for the admin laptop and the projector.
- Players' phone browsers allow camera access over HTTPS (Vercel gives HTTPS).
- At most 3 admins (host plus helpers) use one shared admin account role.
- Questions are multiple choice or one word. One-word answers are compared without case and after trimming spaces, with optional accepted alternative answers.

## Open questions

| # | Question | Owner |
|---|---|---|
| 1 | Event date and expected number of players | User |
| 2 | Question topics and difficulty mix per round (or should Gemini generate from given topics?) | User |
| 3 | Fest logo, colours and sponsor branding for the screen | User |
| 4 | Projector shows full names, or first name + last 3 digits of USN? (Default: full names) | User |
| 5 | Should eliminated players see a "You're out" screen, or only "Thanks for playing"? (Default: a friendly "Eliminated in round N".) | User |
