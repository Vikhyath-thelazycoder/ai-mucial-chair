// A whole game through the real RPCs against aimc-test: admin-chosen chair schedule, spins until every
// chair is locked by a correct answer, eliminations, and the podium (PRD › Game rules, D-011, D-012).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answerFor,
  currentSessionId,
  deleteCreatedUsers,
  makeAdmin,
  makePlayer,
  resetWorld,
  rpcErr,
  rpcOk,
  seedTestQuestions,
  service,
  type Actor,
} from "./harness";

type Claim = { attemptId: string; question: { id: string } };
type PublicState = {
  game: { status: string };
  spin: { phase: string } | null;
  chairs: { number: number; holder: string | null }[];
  winners: { rank: number; name: string }[];
  event: { kind: string; eliminated?: string[] } | null;
  playersRemaining: number;
};

// Deterministic pseudo-random so failures are reproducible.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const shuffle = <T,>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

const PLAYERS = 11;
const SCHEDULE = [7, 4, 2]; // chairs per round, chosen by the admin
const FINAL_COUNT = 2; // admin-set final-round chair count

let admin: Actor;
let players: (Actor & { usn: string; playerId: string })[];

async function publicState(): Promise<PublicState> {
  const { data, error } = await service.from("public_state").select("data").single();
  if (error) throw error;
  return data.data as PublicState;
}

async function statusOf(playerId: string) {
  const { data } = await service.from("players").select("status, final_rank").eq("id", playerId).single();
  return data!;
}

beforeAll(async () => {
  await resetWorld();
  await seedTestQuestions(60);
  admin = await makeAdmin("game-admin");
  const made = await Promise.all(Array.from({ length: PLAYERS }, (_, i) => makePlayer(`g${i}`)));
  const sid = await currentSessionId();
  const { data } = await service.from("players").select("id, user_id").eq("session_id", sid).in("user_id", made.map((m) => m.userId));
  players = made.map((m) => ({ ...m, playerId: data!.find((d) => d.user_id === m.userId)!.id }));
  await rpcOk(admin.client, "update_game_settings", { p_final_chair_count: FINAL_COUNT });
  await rpcOk(admin.client, "create_chairs", { p_count: SCHEDULE[0] });
}, 180_000);

afterAll(async () => {
  await resetWorld();
  await deleteCreatedUsers();
});

describe("full game", () => {
  it(
    "runs every round to completion and crowns the final chair holders",
    async () => {
      const { data: allChairs } = await service.from("chairs").select("id, number, secret").order("number");

      for (const [roundIndex, chairCount] of SCHEDULE.entries()) {
        // Admin sets the chairs in play for this round.
        const inPlay = allChairs!.slice(0, chairCount);
        const outOfPlay = allChairs!.slice(chairCount).map((c) => c.id);
        if (outOfPlay.length) await rpcOk(admin.client, "set_chairs_active", { p_ids: outOfPlay, p_active: false });

        const { data: game } = await service.from("games").select("current_session_id").single();
        const { data: activeRows } = await service.from("players").select("id").eq("status", "active").eq("session_id", game!.current_session_id);
        const activeIds = new Set(activeRows!.map((r) => r.id));
        expect(activeIds.size).toBeGreaterThan(chairCount);

        const round = await rpcOk<{ roundNumber: number; isFinal: boolean }>(admin.client, "start_round", {});
        expect(round.roundNumber).toBe(roundIndex + 1);
        expect(round.isFinal).toBe(chairCount <= FINAL_COUNT);

        const lockedChairs = new Set<string>();
        const lockedPlayers = new Set<string>();
        let spins = 0;
        while (lockedChairs.size < chairCount) {
          spins++;
          expect(spins).toBeLessThan(40);
          await rpcOk(admin.client, "open_scan_window");

          // Chairs can't change while players scan.
          expect(await rpcErr(admin.client, "create_chairs", { p_count: 1 })).toBe("INVALID_TRANSITION");

          const lockedBefore = lockedChairs.size;
          const free = inPlay.filter((c) => !lockedChairs.has(c.id));
          const standing = shuffle(players.filter((p) => activeIds.has(p.playerId) && !lockedPlayers.has(p.playerId)));
          const seated = free.map((chair, i) => ({ chair, player: standing[i] })).filter((s) => s.player);

          await Promise.all(
            seated.map(async ({ chair, player }) => {
              const claim = await rpcOk<Claim>(player.client, "claim_chair", { p_chair_id: chair.id, p_secret: chair.secret });
              const correct = rand() < 0.6;
              await rpcOk(player.client, "submit_answer", {
                p_attempt_id: claim.attemptId,
                p_answer: await answerFor(claim.question.id, correct),
              });
              if (correct) {
                lockedChairs.add(chair.id);
                lockedPlayers.add(player.playerId);
              }
            }),
          );

          // Mid-window the public can't tell who was right: only earlier, judged locks are shown.
          expect((await publicState()).chairs.filter((c) => c.holder !== null)).toHaveLength(lockedBefore);

          await rpcOk(admin.client, "close_scan_window");
          const ps = await publicState();
          expect(ps.spin?.phase).toBe("judging");
          expect(ps.chairs.filter((c) => c.holder !== null)).toHaveLength(lockedChairs.size);

          if (lockedChairs.size < chairCount) {
            expect(await rpcErr(admin.client, "end_round")).toBe("ROUND_NOT_COMPLETE");
            await rpcOk(admin.client, "next_spin");
          }
        }

        expect(await rpcErr(admin.client, "next_spin")).toBe("ROUND_COMPLETE");
        // A locked chair can't be removed before the round is closed.
        expect(await rpcErr(admin.client, "delete_chairs", { p_ids: [inPlay[0].id] })).toBe("CHAIR_LOCKED");

        const result = await rpcOk<{ eliminated: string[]; finished: boolean }>(admin.client, "end_round");
        expect(result.eliminated).toHaveLength(activeIds.size - chairCount);
        expect(result.finished).toBe(chairCount <= FINAL_COUNT);

        for (const id of activeIds) {
          const s = await statusOf(id);
          if (lockedPlayers.has(id)) expect(s.status).toBe(result.finished ? "winner" : "active");
          else expect(s.status).toBe("eliminated");
        }

        const ps = await publicState();
        expect(ps.event?.kind).toBe(result.finished ? "podium" : "round_over");
        expect(ps.event?.eliminated).toHaveLength(result.eliminated.length);
      }

      // Podium: final holders ranked by their final-round correct time.
      const ps = await publicState();
      expect(ps.game.status).toBe("finished");
      expect(ps.winners.map((w) => w.rank)).toEqual([1, 2]);

      const { data: finalAttempts } = await service
        .from("attempts")
        .select("player_id, time_ms, rounds!inner(number)")
        .eq("result", "correct")
        .eq("rounds.number", SCHEDULE.length)
        .order("time_ms");
      for (const [i, a] of finalAttempts!.entries()) {
        expect((await statusOf(a.player_id)).final_rank).toBe(i + 1);
      }

      // Nothing more can happen once the game is finished.
      expect(await rpcErr(admin.client, "start_round")).toBe("INVALID_TRANSITION");
    },
    300_000,
  );

  it("my_status tells each player their outcome without revealing answers", async () => {
    const statuses = await Promise.all(players.map((p) => rpcOk<Record<string, unknown>>(p.client, "my_status")));
    const kinds = statuses.map((s) => (s.player as { status: string }).status);
    expect(kinds.filter((k) => k === "winner")).toHaveLength(FINAL_COUNT);
    expect(kinds.filter((k) => k === "eliminated")).toHaveLength(PLAYERS - FINAL_COUNT);
    expect(JSON.stringify(statuses)).not.toMatch(/"answer"|alternatives|secret/);
  });

  it("the admin can add and delete any number of chairs between rounds", async () => {
    await rpcOk(admin.client, "reset_game", { p_confirm: "RESET" });
    const added = await rpcOk<{ id: string; number: number }[]>(admin.client, "create_chairs", { p_count: 25 });
    expect(added).toHaveLength(25);
    expect(added[0].number).toBe(SCHEDULE[0] + 1);
    await rpcOk(admin.client, "delete_chairs", { p_ids: added.slice(0, 20).map((c) => c.id) });
    const { count } = await service
      .from("chairs")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .gt("number", SCHEDULE[0]);
    expect(count).toBe(5);
  });
});
