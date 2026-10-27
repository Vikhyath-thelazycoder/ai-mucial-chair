# Release checklist: AI Musical Chair at Techvidya

For the organisers running the game at Sai Vidya Institute of Technology. Tick each box; sign off at the bottom.

Live site: `https://ai-mucial-chair.vercel.app` (the main link opens the admin login). Live database: Supabase project `kmeek…`. Test database: `yirhdf…` (bots and rehearsals only).

## 1. Before the fest (once)

### Database and site
- [ ] Live database has every migration, 0001 to 0012: `supabase link --project-ref <live ref>` then `supabase migration list --linked` shows no missing remote entries. (0010 and 0011 were applied on 2026-10-17.)
- [ ] Vercel Production has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` and `GEMINI_API_KEY`, and **no** service-role key (SECURITY.md › Secrets). Optional: `NEXT_PUBLIC_SITE_URL` = the live address.
- [ ] Latest `main` is deployed: the main link redirects to `/admin/login`, and `/screen` shows the TECHVIDYA header.

### Sign-in limit (must do)
- [ ] Supabase dashboard (live project) → **Authentication → Rate Limits → Sign-ups and sign-ins**: raise from **30** to at least **300** per 5 minutes. All phones on the campus WiFi share one IP; at the default, the 31st student to join within 5 minutes is refused (docs/reports/wifi-signin.md).

### Accounts
- [ ] One admin account per host: Supabase → Authentication → Users → **Add user** (email + strong password, Auto Confirm on), then in SQL Editor: `insert into public.admins (user_id) select id from auth.users where email = '<admin email>';`
- [ ] Each host has logged in once at the main link and sees the Game console.

### Game content
- [ ] Questions → enough enabled questions at every difficulty (at least 2 × the number of players per difficulty you will use; each player never sees a question twice).
- [ ] Settings → game name, default answer timer, **Final round when chairs are at or below** (for example 3), Registration open.
- [ ] Chairs & QR → create the chairs you own, print the QR sheet (2 per A4) and tape one QR to each chair's backrest. Chair numbers on the projector match the printed numbers.

### Music (Spotify)
- [ ] Spotify developer app: redirect URI `https://ai-mucial-chair.vercel.app/admin/spotify/callback` added; the host's **Premium** account added under Users and access.
- [ ] Settings → Spotify check: every line green after **Play test song** on the projector laptop.
- [ ] Decide: "Pause opens scan window" on or off (the Music stopped button / Space always works).

### Projector laptop
- [ ] Desktop Chrome, charger plugged in, sleep and screen saver off, notifications off.
- [ ] Admin console in one window; **Projector ↗** opens `/screen` in a second window on the projector; press **F** for fullscreen.
- [ ] The 3D stage runs smoothly at the projector resolution (if it stutters, it drops the mirrored floor by itself; close other apps).
- [ ] Laptop audio goes to the hall speakers.

## 2. Rehearsal (day before)

- [ ] Bots: `npx tsx --env-file=.env.local scripts/simulate.ts --bots 30 --schedule 25,15,8,3 --runs 5` → 5/5 green (runs on the test database only).
- [ ] Real phones on the **campus WiFi**: 5+ volunteers open the join QR, register (name, USN, phone, branch, 6-digit PIN), and appear on the admin Players page.
- [ ] Play one full round: Start round → music → **Space** (Music stopped) → volunteers scan their chair QR → answer → **J** (close scan & judge) → **R** (show results on projector: green/red) → **N** next spin … → **E** end round.
- [ ] Projector shows a seated person with the name the moment each volunteer scans, green/red only after R, and red players stand up on N.
- [ ] Test a reload of the projector tab mid-round: it comes back to the same state without replaying animations.
- [ ] Test a wrong PIN and an admin PIN reset (Players page) for one volunteer.
- [ ] Settings → **New game** to clear the rehearsal (this also clears the chairs: add the real chairs and print their QR sheet afterwards).

## 3. Event day runbook

1. Settings → **New game** for each new team (clears chairs and registrations), then Chairs & QR → add this game's chairs and print the QR sheet.
2. Show the join QR (Game page → Join the game → Show big); wait until everyone is registered.
3. For each round: set the chair count (Chairs & QR or the Start round dialog) → **Start round**.
4. Each spin: play music → stop it (Space, or pause if auto-open is on) → players scan and answer → **J** → check the chair map, override any disputed result (reason required) → **R** to show results → **N** next spin, until every chair is green → **E** end round.
5. The final round crowns the chair holders; the projector shows the podium. Start a New game for the next team.

Shortcuts: `Space` music stopped · `J` close scan & judge · `R` show results on projector · `N` next spin · `E` end round.

## 4. If something goes wrong

| Problem | What to do |
|---|---|
| Spotify stops or won't connect | Play music from any device and press **Space** / Music stopped; the game never depends on Spotify. |
| A student can't log in | Players page → reset their PIN; or remove a squatted USN registration. "Too many requests" means the sign-in limit in section 1 wasn't raised. |
| A phone's camera won't open | They must use the site over https (the official link) and allow the camera; one tap on Try again. |
| A disputed answer | Chair map → open the chair → override with a reason (it's logged), before pressing R. |
| Projector frozen or blank | Reload the tab and press F; state comes back from the server. |
| Wrong round started | End it (Force end needs a reason), or Settings → Restart this game. |
| Live updates stop ("Reconnecting…") | Wait a few seconds; if it persists, reload the admin page. Nothing is lost. |

## 5. Sign-off

| Item | Checked by | Date |
|---|---|---|
| Before the fest (section 1) | | |
| Rehearsal with real phones (section 2) | | |
| Event-day runbook read by every host (section 3) | | |
| **Go live approved** | | |
