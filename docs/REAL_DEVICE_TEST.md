# Real-device test on the live site

For the host and 5–15 volunteers with their own phones. About 45 minutes. Uses the live site, `https://ai-mucial-chair.vercel.app`; a **New game** at the start and end keeps the test separate from the real event.

## Before you start

- [ ] Supabase (live) → Authentication → Rate Limits → **Sign-ups and sign-ins** raised to 300 (otherwise only 30 people can join in 5 minutes).
- [ ] Admin laptop: desktop Chrome, logged in at the main link. Projector: **Projector ↗** opened in a second window, **F** for fullscreen.
- [ ] Settings → **New game**. Chairs & QR → as many chairs as volunteers minus 2; print the QR sheet (or show the codes on another screen) and put one on each chair.
- [ ] Volunteers use different phones: at least one **iPhone (Safari)**, one **Android (Chrome)**, one older or small phone. All on the **campus WiFi**, not mobile data.

## Test steps

Tick each one; write anything odd in the issue log at the bottom.

| # | Who | Do this | What should happen |
|---|---|---|---|
| 1 | Volunteers | Scan the join QR (Game page → Show big) with the phone camera | `/play` opens in the browser |
| 2 | Volunteers | Register: name, USN, phone, branch, 6-digit PIN | "You're in"; the name appears on the admin Players page |
| 3 | One volunteer | Close the browser, reopen the link, log in with USN + PIN | Back to the same status screen |
| 4 | One volunteer | Log in with a wrong PIN | Clear error; the admin can reset the PIN from Players |
| 5 | Host | Start round 1, play music | Phones show "Music playing, walk!"; projector shows WALK! and turns the ring |
| 6 | One volunteer | Scan a chair QR **before** the music stops | Refused: "Wait for the music to stop" |
| 7 | Host | Stop the music (**Space**) | Phones open the camera by themselves; projector shows SCAN NOW |
| 8 | Volunteers | Sit and scan your chair | Phone shows the question; the projector seats a person with your **full name**, no overlap with other names or with SCAN NOW |
| 9 | Two volunteers | Scan the **same** chair at once | Only one gets it; the other sees "Someone scanned that chair first" |
| 10 | One volunteer | While answering, switch to another app and back | Phone shows "YOU LEFT THE GAME"; the admin sees an anti-cheat alert |
| 11 | One volunteer | Don't answer; let the timer run out | Counts as wrong |
| 12 | Host | **J** (close scan), check the chair map, then **R** (show results) | Projector: green for right, red for wrong; nothing green/red before R |
| 13 | Host | **N** (next spin) | Red players' people stand up and leave; green stay seated; repeat until all chairs are green |
| 14 | Host | **E** (end round) | "Round 1 over" with the eliminated names; eliminated phones say so |
| 15 | Host | Drag the projector stage with the mouse | Spins around the ring / tilts up and down; every chair stays in view |
| 16 | Host | Reload the projector tab mid-round | Comes back to the same state without replaying animations |
| 17 | Host | Set fewer chairs, play rounds until the final | Final round sting; podium with the winners' names and confetti |
| 18 | Host | Settings → **Spotify check** → Play test song; play a spin with "Pause opens scan window" on | Music plays on the laptop; pausing opens the scan window |
| 19 | Host | Settings → **New game** | Fresh lobby; zero chairs; old chair QR codes no longer work |

## What to watch for (and note in the log)

- Camera doesn't open, or needs more than one tap (note the phone and browser).
- Anything slow: registering, scanning, the question appearing (more than ~2 seconds).
- Text cut off or overlapping on any phone, the admin panel, or the projector.
- The projector stuttering, or names hard to read from the back of the hall.
- Any error message a volunteer didn't understand.

## Issue log

| # | Step | Phone / browser | What happened | Screenshot? |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
