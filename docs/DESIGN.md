# Design: AI Musical Chair

## Visual direction

- **Purpose:** a live party game run in a college auditorium. Three surfaces with different jobs:
  - **Player:** one hand, standing, in a hurry. Big targets, one action per screen, readable within half a second.
  - **Admin:** a dense, scannable control room. Status at a glance, no hunting for buttons.
  - **Screen:** stage spectacle, readable from the back of a hall (minimum text height 48 px at 1080p).
- **Tone:** "neon game-show arena". Dark stage, glowing chairs, sharp arcade typography, confident motion.
- **Memorable detail:**
  - A **ring of glowing 3D chairs** (custom GLB from Blender) is the signature object on all three surfaces.
  - Chairs light up as they're locked and go dark as they're removed between rounds.
  - The podium rises out of the same ring.
- **Anti-patterns to avoid:** purple-to-pink gradients, decorative blobs, nested cards, vague hero copy, and stock imagery.

## Component principles

- Every screen shows **one primary state** in big type, for example "SCAN NOW", "STAY SEATED" or "WALK!".
- **Admin:**
  - The game control bar is pinned at the top and shows only valid next actions.
  - The live chair map is the main view, with stats and alerts in a side rail.
- Glass panels (`backdrop-blur`, 1 px light border) over the 3D background on the admin panel and the screen. Player screens use solid panels for speed.
- Content states for every data view:

| State | Trigger | Feedback | Next action |
|---|---|---|---|
| Loading | First fetch or reconnect | Skeleton plus a "Connecting…" pulse | Automatic |
| Empty | No chairs, players or questions yet | Short explanation | Primary button (Create chairs / Show join QR / Add questions) |
| Error | RPC error code | Friendly message mapped from the code | Retry, or what to do (for example "Wait for the music to stop") |
| Partial | Realtime disconnected | "Reconnecting…" badge, last known data dimmed | Automatic resync |
| Success | Scan or answer recorded | Haptic (`navigator.vibrate`) plus a check-mark burst | "Waiting for host…" |
| Permission | Camera denied, or not an admin | How to allow the camera in the browser / "Admins only" | Retry button / back to `/play` |

## Typography

- **Display:** *Orbitron*, used for state words, round numbers and podium names. Uppercase, letter-spacing +0.04em.
- **UI/body:** *Space Grotesk* (400/500/700).
- **Numbers:** *JetBrains Mono* with tabular figures, for timers, `time_ms` and counts.
- **Scale (rem):** 0.875 · 1 · 1.25 · 1.5 · 2 · 3 · 4.5 · 7 (screen only).

## Color

Tokens are CSS variables in `src/app/globals.css`, with a dark theme only (stage lighting):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#07070C` | Stage black |
| `--surface` | `#11121C` | Panels |
| `--line` | `#262838` | Borders |
| `--text` | `#F2F4FF` | Primary text |
| `--muted` | `#8A90B2` | Secondary text |
| `--cyan` | `#22E4FF` | Primary / music / brand glow |
| `--lime` | `#B6FF3B` | Locked in / correct (admin only) |
| `--amber` | `#FFB020` | Scan window / attention |
| `--red` | `#FF3B5C` | Wrong / eliminated / alerts |
| `--gold` | `#FFD54A` | Podium 1st |

- Correct and wrong use **icon + color** (✅ ❌), never color alone.
- The cyan, amber and red accents are different hues, so the palette isn't a single colour family.

## Spacing

- 4 px base scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Player screens use a 16 px gutter. Tap targets are at least 56 px.
- Admin chair tiles are 160×120 in a fixed grid, so tiles don't jump when content changes.

## Responsive rules

- **Player:** designed for 360–430 px wide, portrait. Works up to tablet.
- **Admin:** designed for 1280–1920 px. Usable at 1024 (side rail collapses).
- **Screen:** 16:9 at 1920×1080 with a 4K-safe layout. Uses `vw`-based type for projectors.
- No horizontal scroll at any width. Long names truncate with an ellipsis and show in full on hover (admin).

## Interaction

- **Player:**
  - The scanner opens automatically when the phase becomes `scan_open` (one tap if the camera needs permission).
  - MCQ options are full-width buttons. A one-word answer uses one input plus a big Submit.
  - The answer is confirmed once (no double submit).
- **Admin:**
  - Keyboard shortcuts: `Space` = Music stopped / open scan, `J` = close window (judging), `N` = next spin, `E` = end round (confirm dialog).
  - Destructive actions need typed confirmation.
- **Screen:** no interaction. Press `F` for fullscreen.

## Accessibility

- WCAG 2.2 AA:
  - text contrast ≥ 4.5:1 on `--bg` and `--surface` (all tokens above pass on `--bg`);
  - visible focus rings (cyan, 2 px);
  - every control reachable by keyboard on admin;
  - `aria-live="assertive"` on the player state word so screen readers announce SCAN NOW.
- `prefers-reduced-motion`: turns off camera moves, shakes and confetti on the player site and the admin panel. On the screen, fades replace them.
- Timers are announced at 10 s and 5 s, and also shown as a shrinking bar (not just numbers).

## Motion

Every animation has a job:

| Motion | Purpose | Tool |
|---|---|---|
| Chair ring slow rotation + bloom | Sets the scene; shows the chair count | R3F + postprocessing |
| SCAN NOW flash (amber pulse, 2 beats) | Cue to scan, the most important moment | Framer Motion |
| Chair lights up when locked (screen) | Shows progress through the round | R3F spring |
| "Round N over" + eliminated names fade out | Story beat for the audience | GSAP timeline |
| Chairs sink and disappear when removed | Shows the shrinking game | R3F + GSAP |
| Podium rise + confetti | Payoff | R3F + canvas-confetti |
| Chair tile state changes (admin) | Spot new data instantly | Framer Motion layout |

- **Durations:** UI 150–250 ms ease-out. Stage sequences 1.5–6 s.
- Sequences are triggered by `public_state.event_seq` so a reload doesn't replay them.
- **Performance:**
  - DPR capped at 1.5 on phones, 2 on the projector.
  - `frameloop="demand"` when nothing animates.
  - Always the realistic 3D chairs, never a 2D stand-in (D-020). A measured FPS drop switches the scene to low quality (no mirrored floor or bloom); phones' status ring starts at low quality. `prefers-reduced-motion` stops the ring turning.

## Reference sources

- The user's brief: modern, game-like, 3D, motion graphics, college tech fest.
- Game-show stage lighting (dark stage, spotlight accents) for the screen. Arcade HUDs for the state words.
- Agylite design capabilities used: design/design-direction, design/motion, design/accessibility.
- **Assets:** chair and trophy GLBs modelled through Blender MCP (low-poly, emissive edge strips, under 1 MB). Fest logo from the user (pending).
