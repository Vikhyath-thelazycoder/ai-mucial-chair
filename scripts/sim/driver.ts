// Bot game driver (T-801). Plays whole games on the aimc-test project through the real RPCs: an admin bot runs
// rounds and spins, player bots race for chairs and answer right or wrong, and every step is checked against the
// game rules. Shared by scripts/simulate.ts (stress runs) and scripts/record-demo.ts (the demo video).
import type { SupabaseClient } from "@supabase/supabase-js";
import { anon, answerFor, makeAdmin, makePlayer, resetWorld, rpcOk, seedTestQuestions, service, sleep, type Actor } from "../../integration/harness";

export type Bot = Actor & { usn: string; playerId: string; name: string };
type Seat = { number: number; occupant: string | null; state: string };
type Chair = { id: string; number: number; secret: string; is_active: boolean };
type Claim = { attemptId: string; question: { id: string } };

/** Admin steps; the demo routes these through the real admin page instead of the RPCs. */
export type AdminAction = "start_round" | "open_scan_window" | "close_scan_window" | "reveal_results" | "next_spin" | "end_round";

export type Pace = {
  /** Music before the admin stops it. */
  musicMs: number;
  /** Bots sit down and scan within this window after the music stops. */
  claimSpreadMs: number;
  /** Bots answer this long after scanning (min..max). */
  answerMs: [number, number];
  /** Pause after closing the window, before revealing, and after revealing. */
  beatMs: number;
  /** Pause after a round ends (round-over sting). */
  roundGapMs: number;
};

export const FAST: Pace = { musicMs: 0, claimSpreadMs: 0, answerMs: [0, 0], beatMs: 0, roundGapMs: 0 };

export type Options = {
  bots: number;
  /** Active chairs per round, e.g. [25, 15, 8, 3]. The last one is the final round. */
  schedule: number[];
  /** Chance a bot answers correctly. */
  correctRate: number;
  /** Chance a bot never answers (counts as wrong when the window closes). */
  noAnswerRate: number;
  /** Change chairs between rounds by randomly adding and deleting, not just switching off. */
  randomChairOps: boolean;
  pace: Pace;
  seed: number;
  /** Logs one line per step (the demo shows these as captions). */
  log: (line: string) => void;
  /** Runs an admin step; defaults to the RPC as the admin bot. */
  admin?: (action: AdminAction, admin: Actor) => Promise<void>;
  /** Player ids played by someone else (the demo's phone); bots leave chair `reservedChair` free for them. */
  external?: { playerIds: string[]; reservedChair: number };
};

export type RunReport = {
  rounds: number;
  spins: number;
  claims: number;
  contested: number;
  correct: number;
  wrong: number;
  timedOut: number;
  eliminated: number;
  winners: { rank: number; name: string }[];
  claimLatencyMs: { p50: number; p95: number; max: number };
  checks: number;
  durationMs: number;
};

export class InvariantError extends Error {}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
};

let bots: Bot[] = [];

/** Fresh game session, test questions and N registered bots (accounts are pooled across runs). */
export async function setupWorld(count: number): Promise<{ admin: Actor; bots: Bot[] }> {
  await resetWorld();
  await seedTestQuestions(120);
  const admin = await makeAdmin("sim-admin");
  const made: (Actor & { usn: string })[] = [];
  // Sequential: registration is cheap, and sign-ins are rate limited per IP (pooled accounts sign in once).
  for (let i = 0; i < count; i++) made.push(await makePlayer(`bot${i}`));
  // Pooled accounts have rows in earlier (possibly aborted) games too: only this game's rows count.
  const { data: game } = await service.from("games").select("current_session_id").single();
  const { data, error } = await service
    .from("players")
    .select("id, user_id, name")
    .in("user_id", made.map((m) => m.userId))
    .eq("session_id", game!.current_session_id);
  if (error) throw error;
  bots = made.map((m) => {
    const row = data!.find((d) => d.user_id === m.userId)!;
    return { ...m, playerId: row.id, name: row.name };
  });
  return { admin, bots };
}

async function seats(): Promise<Seat[]> {
  const { data, error } = await anon().from("stage_seats").select("number, occupant, state").order("number");
  if (error) throw error;
  return data as Seat[];
}

async function activeChairs(): Promise<Chair[]> {
  const { data, error } = await service.from("chairs").select("id, number, secret, is_active").is("deleted_at", null).order("number");
  if (error) throw error;
  return (data as Chair[]).filter((c) => c.is_active);
}

async function activePlayerIds(): Promise<Set<string>> {
  const { data: g } = await service.from("games").select("current_session_id").single();
  const { data } = await service.from("players").select("id").eq("session_id", g!.current_session_id).eq("status", "active");
  return new Set((data ?? []).map((r) => r.id));
}

/** Sets exactly `count` active chairs. Keeps `keep` (the demo phone's chair) and the lowest numbers. */
async function setChairs(admin: Actor, count: number, random: boolean, rand: () => number, keep: number | null, log: Options["log"]) {
  let active = await activeChairs();
  if (random && active.length > 0 && rand() < 0.6) {
    // Admin-style churn: delete a few chairs and add new ones, then trim to the target.
    const deletable = active.filter((c) => c.number !== keep);
    const del = deletable.slice(0, Math.min(deletable.length, 1 + Math.floor(rand() * 3)));
    if (del.length) await rpcOk(admin.client, "delete_chairs", { p_ids: del.map((c) => c.id) });
    const add = 1 + Math.floor(rand() * 3);
    await rpcOk(admin.client, "create_chairs", { p_count: add });
    log(`Admin deletes ${del.length} chair(s) and adds ${add}`);
    active = await activeChairs();
  }
  if (active.length < count) {
    await rpcOk(admin.client, "create_chairs", { p_count: count - active.length });
  } else if (active.length > count) {
    const off = [...active].sort((a, b) => (a.number === keep ? -1 : b.number === keep ? 1 : a.number - b.number)).slice(count);
    await rpcOk(admin.client, "set_chairs_active", { p_ids: off.map((c) => c.id), p_active: false });
  }
  const now = await activeChairs();
  if (now.length !== count) throw new InvariantError(`expected ${count} active chairs, got ${now.length}`);
  return now;
}

async function adminRpc(action: AdminAction, admin: Actor) {
  await rpcOk(admin.client, action, {});
}

/** Plays one complete game and checks the rules at every step. Throws InvariantError on any violation. */
export async function playGame(admin: Actor, o: Options): Promise<RunReport> {
  const t0 = Date.now();
  const rand = rng(o.seed);
  const doAdmin = o.admin ?? adminRpc;
  const external = new Set(o.external?.playerIds ?? []);
  const reserved = o.external?.reservedChair ?? null;
  const latencies: number[] = [];
  const r: RunReport = { rounds: 0, spins: 0, claims: 0, contested: 0, correct: 0, wrong: 0, timedOut: 0, eliminated: 0, winners: [], claimLatencyMs: { p50: 0, p95: 0, max: 0 }, checks: 0, durationMs: 0 };
  const check = (ok: boolean, what: string) => {
    r.checks++;
    if (!ok) throw new InvariantError(what);
  };

  for (const [ri, chairCount] of o.schedule.entries()) {
    const active = await activePlayerIds();
    check(active.size > chairCount, `round ${ri + 1}: ${active.size} players for ${chairCount} chairs`);
    const chairs = await setChairs(admin, chairCount, o.randomChairOps && ri > 0, rand, reserved, o.log);
    const isFinal = ri === o.schedule.length - 1;
    o.log(`Round ${ri + 1}${isFinal ? " (final)" : ""}: ${active.size} players, ${chairCount} chairs`);
    await doAdmin("start_round", admin);
    r.rounds++;
    check((await seats()).every((s) => s.state === "empty"), "new round starts with every seat empty");

    const locked = new Map<string, string>(); // chairId -> playerId
    for (let spin = 1; locked.size < chairCount; spin++) {
      check(spin < 60, `round ${ri + 1} isn't converging`);
      r.spins++;
      o.log(`Round ${ri + 1} · spin ${spin}: music plays, players walk`);
      await sleep(o.pace.musicMs);
      await doAdmin("open_scan_window", admin);
      const spinId = await currentSpinId();
      o.log("Music stops → SCAN NOW");

      // Standing bots race for the free chairs: several may run at the same chair; exactly one may win it.
      const free = chairs.filter((c) => !locked.has(c.id) && c.number !== reserved);
      const lockedPlayers = new Set(locked.values());
      const standing = bots.filter((b) => active.has(b.playerId) && !lockedPlayers.has(b.playerId) && !external.has(b.playerId));
      const targets = standing.map((b) => ({ bot: b, chair: free[Math.floor(rand() * Math.max(free.length, 1))] })).filter((t) => t.chair);
      const perChair = new Map<string, number>();
      for (const t of targets) perChair.set(t.chair.id, (perChair.get(t.chair.id) ?? 0) + 1);
      const contested = [...perChair.values()].filter((n) => n > 1).length;
      r.contested += contested;

      const results = await Promise.all(
        targets.map(async ({ bot, chair }) => {
          await sleep(rand() * o.pace.claimSpreadMs);
          const t = Date.now();
          const { data, error } = await bot.client.rpc("claim_chair", { p_chair_id: chair.id, p_secret: chair.secret });
          latencies.push(Date.now() - t);
          return { bot, chair, claim: data as Claim | null, error: error?.message ?? null };
        }),
      );
      const won = results.filter((x) => !x.error);
      for (const x of results.filter((x) => x.error)) check(x.error === "CHAIR_TAKEN", `unexpected claim error ${x.error}`);
      const winners = new Map<string, number>();
      for (const w of won) winners.set(w.chair.id, (winners.get(w.chair.id) ?? 0) + 1);
      check([...winners.values()].every((n) => n === 1), "a chair was claimed twice in one spin");
      for (const [chairId, n] of perChair) check(winners.get(chairId) === 1 || n === 0, "a contested chair ended with no winner");
      r.claims += won.length;
      o.log(`${won.length} bot(s) sat down${contested ? ` · ${contested} chair(s) raced for, one winner each` : ""}`);

      // Mid-window: the projector shows who sat, never right/wrong.
      const mid = await seats();
      check(!mid.some((s) => s.state === "wrong"), "projector showed red before the reveal");
      check(mid.filter((s) => s.state === "seated").length >= won.length, "a scan didn't seat its player on the projector");

      // Answers: right, wrong, or never (times out at close).
      await Promise.all(
        won.map(async (w) => {
          if (rand() < o.noAnswerRate) return;
          const correct = rand() < o.correctRate;
          await sleep(o.pace.answerMs[0] + rand() * (o.pace.answerMs[1] - o.pace.answerMs[0]));
          await rpcOk(w.bot.client, "submit_answer", { p_attempt_id: w.claim!.attemptId, p_answer: await answerFor(w.claim!.question.id, correct) });
        }),
      );
      if (o.external) await waitForExternal(o.external.playerIds, o.pace.answerMs[1] + 8000);

      await doAdmin("close_scan_window", admin);
      o.log("Admin closes the scan window → judging");
      check(!(await seats()).some((s) => s.state === "wrong"), "projector showed red before the reveal (judging)");
      await sleep(o.pace.beatMs);

      await doAdmin("reveal_results", admin);
      const { data: spinAttempts } = await service.from("attempts").select("chair_id, player_id, result").eq("spin_id", spinId);
      const thisSpin = (spinAttempts ?? []) as { chair_id: string; player_id: string; result: string }[];
      for (const a of thisSpin) {
        if (a.result === "correct") locked.set(a.chair_id, a.player_id);
      }
      const nCorrect = thisSpin.filter((a) => a.result === "correct").length;
      const nWrong = thisSpin.filter((a) => a.result === "wrong").length;
      const nTimeout = thisSpin.filter((a) => a.result === "timed_out").length;
      r.correct += nCorrect;
      r.wrong += nWrong;
      r.timedOut += nTimeout;
      const after = await seats();
      check(after.filter((s) => s.state === "correct").length === locked.size, "green seats ≠ locked chairs after reveal");
      check(after.filter((s) => s.state === "wrong").length === nWrong + nTimeout, "red seats ≠ wrong answers after reveal");
      o.log(`Results on the projector: ${nCorrect} green, ${nWrong + nTimeout} red · ${locked.size}/${chairCount} chairs locked`);
      await sleep(o.pace.beatMs * 1.5);

      if (locked.size < chairCount) {
        await doAdmin("next_spin", admin);
        const next = await seats();
        check(!next.some((s) => s.state === "wrong" || s.state === "seated"), "wrong players didn't leave on the next spin");
        check(next.filter((s) => s.state === "correct").length === locked.size, "green players must stay seated");
        o.log("Next spin: red players stand up, green stay seated");
      }
    }

    await doAdmin("end_round", admin);
    const after = await activePlayerIds();
    const lockedPlayers = new Set(locked.values());
    const out = [...active].filter((id) => !lockedPlayers.has(id));
    r.eliminated += out.length;
    if (!isFinal) {
      check(after.size === chairCount && [...after].every((id) => lockedPlayers.has(id)), `round ${ri + 1}: survivors must be exactly the chair holders`);
    }
    o.log(`Round ${ri + 1} over: ${out.length} eliminated, ${isFinal ? "winners crowned" : `${after.size} go through`}`);
    await sleep(o.pace.roundGapMs);
  }

  const { data: game } = await service.from("games").select("status, current_session_id, final_chair_count").single();
  check(game!.status === "finished", "game must finish after the final round");
  const { data: winners } = await service.from("players").select("name, final_rank").eq("session_id", game!.current_session_id).eq("status", "winner").order("final_rank");
  const final = o.schedule[o.schedule.length - 1];
  check(winners!.length === final, `expected ${final} winners, got ${winners!.length}`);
  check(winners!.every((w, i) => w.final_rank === i + 1), "podium ranks must be 1..n with no gaps");
  r.winners = winners!.map((w) => ({ rank: w.final_rank as number, name: w.name as string }));
  o.log(`Winners: ${r.winners.map((w) => `#${w.rank} ${w.name}`).join(", ")}`);
  r.claimLatencyMs = { p50: percentile(latencies, 50), p95: percentile(latencies, 95), max: percentile(latencies, 100) };
  r.durationMs = Date.now() - t0;
  return r;
}

async function currentSpinId(): Promise<string> {
  const { data: g } = await service.from("games").select("current_round_id").single();
  const { data } = await service.from("spins").select("id").eq("round_id", g!.current_round_id).order("number", { ascending: false }).limit(1).single();
  return data!.id as string;
}

/** Waits until every externally played player has answered (or the deadline passes). */
async function waitForExternal(playerIds: string[], maxMs: number) {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    const { data } = await service.from("attempts").select("result, spins!inner(phase)").in("player_id", playerIds).eq("spins.phase", "scan_open");
    if (data && data.length >= playerIds.length && data.every((a) => a.result !== "pending")) return;
    await sleep(400);
  }
}

export type { SupabaseClient };
