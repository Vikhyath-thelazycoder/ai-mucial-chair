# Bot simulation report (T-801)

Generated 2026-10-16T22:16:09.724Z by `scripts/simulate.ts` against the aimc-test project. 30 bot players + 1 admin bot, seed 25345.

| Run | Chairs per round | Rounds | Spins | Claims | Contested chairs | Right | Wrong | Timed out | Eliminated | Winners | Checks | Claim p50 / p95 / max | Time | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 25 → 15 → 8 → 3 | 4 | 15 | 77 | 56 | 51 | 17 | 9 | 27 | 3 | 343 | 62 / 429 / 666 ms | 13.2 s | ✅ green |
| 2 | 25 → 17 → 8 → 3 | 4 | 14 | 79 | 47 | 53 | 24 | 2 | 27 | 3 | 332 | 74 / 157 / 215 ms | 13.1 s | ✅ green |
| 3 | 25 → 15 → 6 → 3 | 4 | 14 | 72 | 47 | 49 | 21 | 2 | 27 | 3 | 315 | 66 / 150 / 400 ms | 14.7 s | ✅ green |
| 4 | 22 → 14 → 9 → 5 → 1 | 5 | 18 | 79 | 53 | 51 | 25 | 3 | 29 | 1 | 370 | 66 / 185 / 351 ms | 16.6 s | ✅ green |
| 5 | 18 → 11 → 6 → 2 | 4 | 14 | 54 | 37 | 37 | 14 | 3 | 28 | 2 | 290 | 57 / 155 / 378 ms | 12.8 s | ✅ green |

Checked at every step: one winner per contested chair and no other claim errors; a scan seats its player on the projector at once; the projector never shows red before the admin reveals; green seats equal locked chairs and red seats equal wrong/timed-out answers after the reveal; red players leave and green stay on the next spin; survivors are exactly the chair holders; the final round crowns exactly its chair count with podium ranks 1..n.

**5/5 runs green.**
