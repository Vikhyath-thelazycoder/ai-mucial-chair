// D-016: scanning, not registering, puts you in the game. Round 1 is open to anyone registered
// (even late); from round 2 only round-1 chair holders can scan.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answerFor,
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

type Chair = { id: string; number: number; secret: string };
type Claim = { attemptId: string; question: { id: string } };
type Status = { player: { status: string }; playedThisGame: boolean };

let admin: Actor;
let early: Actor;
let bystander: Actor;
let late: Actor;
let chairs: Chair[];

async function sitAndAnswer(p: Actor, chair: Chair) {
  const claim = await rpcOk<Claim>(p.client, "claim_chair", { p_chair_id: chair.id, p_secret: chair.secret });
  await rpcOk(p.client, "submit_answer", { p_attempt_id: claim.attemptId, p_answer: await answerFor(claim.question.id, true) });
}

beforeAll(async () => {
  await resetWorld();
  await seedTestQuestions(20);
  admin = await makeAdmin("roster-admin");
  [early, bystander] = await Promise.all([makePlayer("early"), makePlayer("bystander")]);
  await rpcOk(admin.client, "update_game_settings", { p_final_chair_count: 1 });
  await rpcOk(admin.client, "create_chairs", { p_count: 2 });
  const { data } = await service.from("chairs").select("id, number, secret").order("number");
  chairs = data!;
});

afterAll(async () => {
  await resetWorld();
  await deleteCreatedUsers();
});

describe("who is playing", () => {
  it("someone who registers after round 1 started can still sit and scan in round 1", async () => {
    await rpcOk(admin.client, "start_round");
    late = await makePlayer("late");
    const { data } = await service.from("players").select("status").eq("user_id", late.userId).single();
    expect(data?.status).toBe("active");

    await rpcOk(admin.client, "open_scan_window");
    await Promise.all([sitAndAnswer(early, chairs[0]), sitAndAnswer(late, chairs[1])]);
    await rpcOk(admin.client, "close_scan_window");
    await rpcOk(admin.client, "end_round");
  });

  it("a registered player who never scanned is out after round 1, and is told they didn't play", async () => {
    const s = await rpcOk<Status>(bystander.client, "my_status");
    expect(s.player.status).toBe("eliminated");
    expect(s.playedThisGame).toBe(false);
    const winner = await rpcOk<Status>(late.client, "my_status");
    expect(winner).toMatchObject({ player: { status: "active" }, playedThisGame: true });
  });

  it("from round 2, new registrations are spectators and can't scan", async () => {
    await rpcOk(admin.client, "set_chairs_active", { p_ids: [chairs[1].id], p_active: false });
    await rpcOk(admin.client, "start_round");
    const newcomer = await makePlayer("round2");
    const { data } = await service.from("players").select("status").eq("user_id", newcomer.userId).single();
    expect(data?.status).toBe("spectator");
    await rpcOk(admin.client, "open_scan_window");
    expect(await rpcErr(newcomer.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })).toBe("NOT_ACTIVE");
    expect(await rpcErr(bystander.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })).toBe("NOT_ACTIVE");
  });
});
