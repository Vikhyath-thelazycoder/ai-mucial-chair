// Negative-first security tests (SECURITY.md › Assets and threats), run against aimc-test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  currentPlayer,
  answerFor,
  deleteCreatedUsers,
  makeAdmin,
  makePlayer,
  resetWorld,
  rpcErr,
  rpcOk,
  seedTestQuestions,
  service,
  signedInUser,
  sleep,
  type Actor,
} from "./harness";

type Claim = { attemptId: string; chairNumber: number; question: Record<string, unknown> & { id: string } };
type Chair = { id: string; number: number; secret: string };

let admin: Actor;
let p1: Actor;
let p2: Actor;
let p3: Actor;
let chairs: Chair[];

async function loadChairs(): Promise<Chair[]> {
  const { data, error } = await service.from("chairs").select("id, number, secret").order("number");
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  await resetWorld();
  await seedTestQuestions();
  admin = await makeAdmin();
  [p1, p2, p3] = await Promise.all([makePlayer("p1"), makePlayer("p2"), makePlayer("p3")]);
  await rpcOk(admin.client, "create_chairs", { p_count: 3 });
  chairs = await loadChairs();
});

afterAll(async () => {
  await resetWorld();
  await deleteCreatedUsers();
});

describe("T1/T9: reading data players must never see", () => {
  it("anonymous visitors can't read any game table except public_state", async () => {
    const a = anon();
    for (const table of ["questions", "attempts", "players", "chairs", "games", "admins", "alerts", "admin_audit"]) {
      const { data } = await a.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    const { data } = await a.from("public_state").select("data").single();
    expect(data?.data).toHaveProperty("game");
  });

  it("a player sees no questions, answers, attempts, chairs or chair secrets", async () => {
    for (const table of ["questions", "attempts", "chairs", "games", "admins", "alerts", "admin_audit"]) {
      const { data } = await p1.client.from(table).select("*").limit(5);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("a player sees only their own player row", async () => {
    const { data } = await p1.client.from("players").select("user_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((r) => r.user_id))).toEqual(new Set([p1.userId]));
  });

  it("public_state contains no answers, secrets or phone numbers", async () => {
    const { data } = await anon().from("public_state").select("data").single();
    const text = JSON.stringify(data);
    for (const c of chairs) expect(text).not.toContain(c.secret);
    expect(text).not.toMatch(/answer|secret|phone|usn/i);
  });
});

describe("T8: privilege escalation", () => {
  it.each([
    ["start_round", {}],
    ["create_chairs", { p_count: 1 }],
    ["delete_chairs", { p_ids: [] }],
    ["open_scan_window", {}],
    ["end_round", { p_force: true, p_reason: "x" }],
    ["reset_game", { p_confirm: "RESET" }],
    ["update_game_settings", { p_final_chair_count: 1 }],
    ["kick_player", { p_player_id: "00000000-0000-0000-0000-000000000000", p_reason: "x" }],
  ])("a player calling %s gets NOT_ADMIN", async (fn, args) => {
    expect(await rpcErr(p1.client, fn, args)).toBe("NOT_ADMIN");
  });

  it("players can't write game tables directly", async () => {
    const attempts = [
      p1.client.from("public_state").update({ data: {} }).eq("id", 1),
      p1.client.from("players").update({ status: "winner" }).eq("user_id", p1.userId),
      p1.client.from("admins").insert({ user_id: p1.userId }),
      p1.client.from("questions").insert({ text: "Injected question?", type: "one_word", answer: "x", difficulty: 1 }),
      p1.client.from("chairs").insert({ number: 999 }),
    ];
    for (const q of attempts) {
      const { error, data } = await q.select();
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
    expect((await currentPlayer<{ status: string }>(p1.userId, "status")).status).toBe("active");
    const { count } = await service.from("admins").select("*", { count: "exact", head: true }).eq("user_id", p1.userId);
    expect(count).toBe(0);
  });

  it("anonymous visitors can't call RPCs at all", async () => {
    const { error } = await anon().rpc("claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret });
    expect(error).not.toBeNull();
  });
});

describe("T2-T7: chair claims and answers", () => {
  it("T2: a signed-in but unregistered user can't scan", async () => {
    const stranger = await signedInUser("stranger");
    expect(await rpcErr(stranger.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })).toBe(
      "NOT_REGISTERED",
    );
  });

  it("T3: scanning before the music stops is rejected", async () => {
    await rpcOk(admin.client, "start_round", {});
    expect(await rpcErr(p1.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })).toBe(
      "SCAN_WINDOW_CLOSED",
    );
  });

  it("T5: a forged or guessed QR secret is rejected", async () => {
    await rpcOk(admin.client, "open_scan_window");
    expect(await rpcErr(p1.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: "guess" })).toBe("BAD_QR");
    expect(await rpcErr(p1.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[1].secret })).toBe("BAD_QR");
  });

  it("T4: two players scanning one chair at the same moment: exactly one wins", async () => {
    const results = await Promise.all(
      [p1, p2].map((p) => p.client.rpc("claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret })),
    );
    const wins = results.filter((r) => !r.error);
    const losses = results.filter((r) => r.error);
    expect(wins).toHaveLength(1);
    expect(losses[0].error?.message).toBe("CHAIR_TAKEN");
  });

  it("T4: one player can't hold two chairs in a spin", async () => {
    const holder = (await service.from("attempts").select("player_id").single()).data!.player_id;
    const { data: holderRow } = await service.from("players").select("user_id").eq("id", holder).single();
    const who = [p1, p2].find((p) => p.userId === holderRow!.user_id)!;
    expect(await rpcErr(who.client, "claim_chair", { p_chair_id: chairs[1].id, p_secret: chairs[1].secret })).toBe(
      "ALREADY_SCANNED_THIS_SPIN",
    );
  });

  it("T1: the question sent to the phone has no answer, and submitting reveals nothing", async () => {
    const claim = await rpcOk<Claim>(p3.client, "claim_chair", { p_chair_id: chairs[2].id, p_secret: chairs[2].secret });
    expect(Object.keys(claim.question).sort()).toEqual(["id", "options", "text", "type"]);
    expect(JSON.stringify(claim)).not.toMatch(/"answer"|alternatives|secret/);
    const res = await rpcOk(p3.client, "submit_answer", {
      p_attempt_id: claim.attemptId,
      p_answer: await answerFor(claim.question.id, true),
    });
    expect(res).toEqual({ received: true });
  });

  it("T7: an answer can't be changed once sent", async () => {
    const { data } = await service.from("attempts").select("id").eq("chair_id", chairs[2].id).single();
    expect(await rpcErr(p3.client, "submit_answer", { p_attempt_id: data!.id, p_answer: "0" })).toBe("ALREADY_ANSWERED");
  });

  it("a player can't answer someone else's attempt", async () => {
    const { data } = await service.from("attempts").select("id").eq("chair_id", chairs[0].id).single();
    expect(await rpcErr(p3.client, "submit_answer", { p_attempt_id: data!.id, p_answer: "0" })).toBe("NOT_FOUND");
  });

  it("correctness stays hidden from the public while the scan window is open", async () => {
    const { data } = await anon().from("public_state").select("data").single();
    const chairsState = (data!.data as { chairs: { holder: string | null }[] }).chairs;
    expect(chairsState.every((c) => c.holder === null)).toBe(true);
  });

  it("T12: anti-cheat alerts are capped per attempt and can't target others' attempts", async () => {
    const { data: mine } = await service.from("attempts").select("id").eq("chair_id", chairs[2].id).single();
    await Promise.all(
      Array.from({ length: 55 }, (_, i) =>
        p3.client.rpc("report_focus_event", { p_attempt_id: mine!.id, p_kind: i % 2 ? "away_end" : "away_start", p_away_ms: 1000 }),
      ),
    );
    const { count } = await service.from("alerts").select("*", { count: "exact", head: true }).eq("attempt_id", mine!.id);
    expect(count).toBe(50);
    const { data: other } = await service.from("attempts").select("id").eq("chair_id", chairs[0].id).single();
    expect(await rpcErr(p3.client, "report_focus_event", { p_attempt_id: other!.id, p_kind: "away_start" })).toBe("NOT_FOUND");
  });

  it("T11: overrides need a reason and are audited", async () => {
    const { data: att } = await service.from("attempts").select("id").eq("chair_id", chairs[0].id).single();
    expect(await rpcErr(admin.client, "override_attempt", { p_attempt_id: att!.id, p_correct: false, p_reason: " " })).toBe(
      "VALIDATION",
    );
    await rpcOk(admin.client, "override_attempt", { p_attempt_id: att!.id, p_correct: false, p_reason: "seen copying" });
    const { data: audit } = await service.from("admin_audit").select("action, reason").eq("target", att!.id);
    expect(audit).toEqual([{ action: "override_attempt", reason: "seen copying" }]);
  });

  it("T6: answers after the deadline count as timed out (server clock)", async () => {
    await rpcOk(admin.client, "close_scan_window");
    await rpcOk(admin.client, "end_round", { p_force: true, p_reason: "test cleanup" });
    await rpcOk(admin.client, "reset_game", { p_confirm: "RESET" });
    await rpcOk(admin.client, "start_round", { p_timer_seconds: 5 });
    await rpcOk(admin.client, "open_scan_window");
    const claim = await rpcOk<Claim>(p1.client, "claim_chair", { p_chair_id: chairs[1].id, p_secret: chairs[1].secret });
    await sleep(7500);
    await rpcOk(p1.client, "submit_answer", { p_attempt_id: claim.attemptId, p_answer: await answerFor(claim.question.id, true) });
    const { data } = await service.from("attempts").select("result").eq("id", claim.attemptId).single();
    expect(data?.result).toBe("timed_out");
  });
});

describe("registration input", () => {
  it("T14: rejects a script tag as a name, and bad USN/phone", async () => {
    const u = await signedInUser("xss");
    expect(
      await rpcErr(u.client, "register_player", { p_name: "<script>alert(1)</script>", p_usn: "4SU22CS999", p_phone: "9876543210", p_branch: "CSE" }),
    ).toBe("VALIDATION");
    expect(await rpcErr(u.client, "register_player", { p_name: "Valid Name", p_usn: "bad usn!", p_phone: "9876543210", p_branch: "CSE" })).toBe(
      "VALIDATION",
    );
    expect(await rpcErr(u.client, "register_player", { p_name: "Valid Name", p_usn: "4SU22CS998", p_phone: "12345", p_branch: "CSE" })).toBe(
      "VALIDATION",
    );
  });

  it("rejects a duplicate USN and a second registration", async () => {
    const existing = await currentPlayer<{ usn: string }>(p1.userId, "usn");
    const u = await signedInUser("dup");
    expect(
      await rpcErr(u.client, "register_player", { p_name: "Dup Person", p_usn: existing.usn, p_phone: "9000000001", p_branch: "CSE" }),
    ).toBe("DUPLICATE_USN");
    expect(await rpcErr(p1.client, "register_player", { p_name: "Again", p_usn: "4SU22CS997", p_phone: "9000000002", p_branch: "CSE" })).toBe(
      "ALREADY_REGISTERED",
    );
  });

  it("players who join during round 1 can still play it (D-016; later rounds are covered in roster.test)", async () => {
    const late = await makePlayer("late");
    expect((await currentPlayer<{ status: string }>(late.userId, "status")).status).toBe("active");
  });
});
