# Architecture: AI Musical Chair

Decisions referenced as D-xxx live in [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md).

## Major components

```
                         ┌──────────────────────────── Vercel (Next.js 15) ────────────────────────────┐
 Player phone ──HTTPS──▶ │ /play      mobile web: register, status, scanner, question (client comps)  │
 Admin laptop ──HTTPS──▶ │ /admin     console, chair map, chairs+QR print, questions, players, music   │
 Projector tab ─HTTPS──▶ │ /screen    read-only 3D scene + animations                                  │
                         │ /c/[id]    "scan from the website" landing (no side effects)                │
                         │ /api/questions/generate   server route → Gemini (admin only)                │
                         └───────────────┬──────────────────────────────────────────┬──────────────────┘
                                         │ supabase-js (RPC, Auth, Realtime)        │ @google/genai
                         ┌───────────────▼─────────────── Supabase cloud ───┐   ┌──▼──────────┐
                         │ Auth (players: USN+PIN, admins: email)           │   │ Gemini API  │
                         │ Postgres: tables + RLS + security-definer RPCs   │   └─────────────┘
                         │ Realtime: public_state, attempts, alerts, players│
                         └──────────────────────────────────────────────────┘
 Admin browser ◀──Web Playback SDK / Web API (PKCE)──▶ Spotify
```

| Component | Responsibility | Lives in |
|---|---|---|
| Game engine (SQL) | All state transitions, claims, grading, eliminations, podium (D-002) | `supabase/migrations/*_rpc.sql` |
| Engine model (TS) | Pure mirror of the rules. Drives UI enablement and unit tests | `src/lib/engine.ts` |
| Data access | Typed RPC wrappers and realtime hooks | `src/lib/supabase/*`, `src/hooks/*` |
| Player app | Mobile flow and anti-cheat | `src/app/play/**`, `src/components/player/**` |
| Admin console | Game control, chair map, management, music, questions | `src/app/admin/**`, `src/components/admin/**` |
| Projector | 3D scenes, sequences | `src/app/screen/**`, `src/components/three/**` |
| AI generation | Prompt, schema, validation | `src/app/api/questions/generate/route.ts`, `src/lib/ai/*` |
| Music | Spotify PKCE, SDK player, controls | `src/lib/spotify/*`, `src/components/admin/music/**` |

## Boundaries

- **Clients never write game tables directly.** Players only call `register_player`, `claim_chair`, `submit_answer`, `report_focus_event` and `my_status`. Admins call admin RPCs plus direct CRUD on `questions` and `chairs`, both protected by admin RLS.
- **The screen is read-only.** It reads `public_state` only.
- **The TS engine never decides anything on its own.** The UI uses it to predict which actions are valid. The SQL RPCs are the authority, and both are tested against the same rule cases.
- **Server-only code** (Gemini key, service role) lives in route handlers and `scripts/`, protected with `import 'server-only'`.

## Data flow

1. A player action calls an RPC, which runs in one transaction: validate, write, rewrite `public_state`.
2. Realtime pushes the change to subscribers: `public_state` goes to everyone, and attempts, alerts and players go to admins.
3. Clients re-render from the pushed state. On reconnect, they refetch `public_state` and `my_status()`, so the state always settles to the correct values.
4. Time values (`scanned_at`, `answered_at`, `time_ms`) always come from the database clock and never from the client (D-004).

Full sequences: [SYSTEM_WORKFLOW.md](SYSTEM_WORKFLOW.md).

## Trust boundaries

| Boundary | Untrusted input | Control |
|---|---|---|
| Phone → Supabase | Registration fields, chair id/secret, answers, focus events | RPC validation, auth.uid() ownership, phase guards, row locks, RLS |
| Admin browser → Supabase | Admin actions | `is_admin()` check in every admin RPC and policy |
| Admin → `/api/questions/generate` | Topic text | Admin session check, zod, length caps; topic passed to Gemini as data |
| Gemini → server | Generated JSON | Treated as untrusted: schema validation, deduplication, admin review before saving |
| Spotify → admin browser | Track metadata | Rendered as text only (React escaping) |
| QR content → phone | Scanned string | Parsed against a strict URL pattern. Anything else is ignored |

## Integrations

- **Supabase:** Auth, Postgres, Realtime. Uses `@supabase/ssr` for cookie sessions in Next.js.
- **Spotify:**
  - Web Playback SDK and Web API, using the Authorization Code with PKCE flow (no client secret).
  - Scopes: `streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private`.
  - Requires Premium.
- **Gemini:** `@google/genai` with structured JSON output. The model is set by `GEMINI_MODEL`.
- **Blender MCP:** used during development only, to create `public/models/chair.glb` and `trophy.glb`. Nothing at runtime.

## Infrastructure

- **Vercel:** one project with Production (fest) and Preview (rehearsal) deployments. Environment variables are set per environment.
- **Supabase:** two cloud projects, **`aimc-prod`** (the fest) and **`aimc-test`** (SQL tests and bot simulation), so tests never touch the live data. Migrations are applied with `supabase db push` to each project.
- No local database or services (D-001).

## Failure modes

| Failure | Effect | Mitigation |
|---|---|---|
| Spotify drops or the token expires | Music stops unexpectedly | The admin hits "Music stopped" manually. Tokens refresh in the background. Backup: play from any device |
| A phone loses network mid-answer | The answer never arrives | Server deadline → `timed_out` (counts as wrong). The phone retries submit on reconnect while still before the deadline |
| A realtime socket drops | A stale screen | Auto-reconnect plus a refetch on `SUBSCRIBED`. A visible "reconnecting" badge |
| Two players scan the same chair at once | Race | `SELECT … FOR UPDATE` on the chair and unique `(spin_id, chair_id)`: the first commit wins |
| The admin double-clicks a transition | Double transition | Every RPC checks the expected current phase (idempotent) |
| The admin laptop crashes | Console lost | All state is on the server. Log in from another device and continue |
| Supabase free-tier connection limit (200) | New phones can't connect | Expected load is ≤ 120. Upgrade to Pro for the event day if needed |
| Low-end phone stalls on 3D | Slow scanning | Low-power detection and `prefers-reduced-motion` → 2D fallback. No 3D on the scanner or question screens |
| Running out of questions at a difficulty | No question to serve | Falls back to the nearest difficulty. The admin dashboard warns when fewer than 2× the active players are left per difficulty |
