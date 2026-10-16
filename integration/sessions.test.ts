// "New game" (D-014): the admin ends one team's game and the next team plays with the same chair QR codes.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteCreatedUsers,
  makeAdmin,
  makePlayer,
  resetWorld,
  rpcErr,
  rpcOk,
  seedTestQuestions,
  service,
  signedInUser,
  type Actor,
} from "./harness";

type Chair = { id: string; number: number; secret: string };

let admin: Actor;
let teamA: (Actor & { usn: string })[];
let chairs: Chair[];
let firstSession: number;

beforeAll(async () => {
  await resetWorld();
  await seedTestQuestions(20);
  admin = await makeAdmin("sess-admin");
  teamA = await Promise.all([makePlayer("a1"), makePlayer("a2"), makePlayer("a3")]);
  await rpcOk(admin.client, "create_chairs", { p_count: 2 });
  const { data } = await service.from("chairs").select("id, number, secret").order("number");
  chairs = data!;
  const { data: g } = await service.from("games").select("game_sessions!games_current_session_id_fkey(number)").single();
  firstSession = (g as unknown as { game_sessions: { number: number } }).game_sessions.number;
});

afterAll(async () => {
  await resetWorld();
  await deleteCreatedUsers();
});

describe("start_new_game", () => {
  it("only an admin can start a new game, and only with the typed confirmation", async () => {
    expect(await rpcErr(teamA[0].client, "start_new_game", { p_confirm: "NEW GAME" })).toBe("NOT_ADMIN");
    expect(await rpcErr(admin.client, "start_new_game", { p_confirm: "yes" })).toBe("VALIDATION");
  });

  it("terminates the game in progress, even mid-scan", async () => {
    await rpcOk(admin.client, "start_round");
    await rpcOk(admin.client, "open_scan_window");
    const claim = await rpcOk<{ attemptId: string }>(teamA[0].client, "claim_chair", {
      p_chair_id: chairs[0].id,
      p_secret: chairs[0].secret,
    });

    const res = await rpcOk<{ sessionNumber: number; previousSession: number }>(admin.client, "start_new_game", {
      p_confirm: "NEW GAME",
    });
    expect(res).toEqual({ sessionNumber: firstSession + 1, previousSession: firstSession });

    const { data: att } = await service.from("attempts").select("result").eq("id", claim.attemptId).single();
    expect(att?.result).toBe("timed_out");
    const { data: ps } = await service.from("public_state").select("data").single();
    const state = ps!.data as { game: { status: string }; round: unknown; event: { kind: string }; playersTotal: number };
    expect(state.game.status).toBe("lobby");
    expect(state.round).toBeNull();
    expect(state.event.kind).toBe("new_game");
    expect(state.playersTotal).toBe(0);
  });

  it("the previous team is out: their phones must register again and can't scan", async () => {
    const status = await rpcOk<{ registered: boolean; playedBefore: boolean }>(teamA[0].client, "my_status");
    expect(status.registered).toBe(false);
    expect(status.playedBefore).toBe(true);
    expect(await rpcErr(teamA[1].client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })).toBe(
      "NOT_REGISTERED",
    );
  });

  it("the next team plays with the same printed chair QR codes", async () => {
    const teamB = await Promise.all([makePlayer("b1"), makePlayer("b2")]);
    await rpcOk(admin.client, "start_round");
    await rpcOk(admin.client, "open_scan_window");
    const claim = await rpcOk<{ chairNumber: number }>(teamB[0].client, "claim_chair", {
      p_chair_id: chairs[0].id,
      p_secret: chairs[0].secret,
    });
    expect(claim.chairNumber).toBe(chairs[0].number);
    await rpcOk(admin.client, "close_scan_window");
  });

  it("a student from an earlier game can join a later one with the same USN", async () => {
    await rpcOk(admin.client, "start_new_game", { p_confirm: "NEW GAME" });
    const { data: old } = await service.from("players").select("usn, phone").eq("user_id", teamA[0].userId).single();
    await rpcOk(teamA[0].client, "register_player", {
      p_name: "Returning Player",
      p_usn: old!.usn,
      p_phone: old!.phone,
      p_branch: "CSE",
    });
    const status = await rpcOk<{ registered: boolean; player: { status: string } }>(teamA[0].client, "my_status");
    expect(status.registered).toBe(true);
    expect(status.player.status).toBe("active");
  });

  it("keeps earlier games' rounds and players for the record", async () => {
    const { data: s1 } = await service.from("game_sessions").select("id, ended_at").eq("number", firstSession).single();
    expect(s1?.ended_at).not.toBeNull();
    const { count: rounds } = await service.from("rounds").select("*", { count: "exact", head: true }).eq("session_id", s1!.id);
    expect(rounds).toBe(1);
    const { count: players } = await service.from("players").select("*", { count: "exact", head: true }).eq("session_id", s1!.id);
    expect(players).toBe(3);
  });

  it("a user who never registered still gets a clean registration prompt", async () => {
    const newcomer = await signedInUser("newcomer");
    const status = await rpcOk<{ registered: boolean; playedBefore: boolean }>(newcomer.client, "my_status");
    expect(status).toMatchObject({ registered: false, playedBefore: false });
  });
});
