// Projector seats (0011): a scan seats the player at once, results stay hidden until the admin reveals
// them (green/red), and the wrong ones leave when the next spin starts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, answerFor, deleteCreatedUsers, makeAdmin, makePlayer, resetWorld, rpcErr, rpcOk, seedTestQuestions, service, type Actor } from "./harness";

type Seat = { number: number; occupant: string | null; state: string };
type Claim = { attemptId: string; question: { id: string } };

let admin: Actor;
let asha: Actor & { usn: string };
let ravi: Actor & { usn: string };
let chairs: { id: string; number: number; secret: string }[];

async function seats(): Promise<Seat[]> {
  // Read exactly as the public projector does: anonymous key, no session.
  const { data, error } = await anon().from("stage_seats").select("number, occupant, state").order("number");
  if (error) throw error;
  return data as Seat[];
}
const seat = (all: Seat[], n: number) => all.find((s) => s.number === n)!;

beforeAll(async () => {
  await resetWorld();
  await seedTestQuestions(20);
  admin = await makeAdmin("stage-admin");
  [asha, ravi] = await Promise.all([makePlayer("stage-asha"), makePlayer("stage-ravi"), makePlayer("stage-extra")]);
  await rpcOk(admin.client, "create_chairs", { p_count: 2 });
  const { data } = await service.from("chairs").select("id, number, secret").is("deleted_at", null).order("number");
  chairs = data!;
}, 120_000);

afterAll(async () => {
  await deleteCreatedUsers();
});

describe("projector seats", () => {
  it("are empty in the lobby, one per active chair", async () => {
    const all = await seats();
    expect(all.map((s) => s.number)).toEqual(chairs.map((c) => c.number));
    expect(all.every((s) => s.state === "empty" && s.occupant === null)).toBe(true);
  });

  it("seat a player the moment they scan, without revealing right or wrong", async () => {
    await rpcOk(admin.client, "start_round", {});
    await rpcOk(admin.client, "open_scan_window");
    const a = await rpcOk<Claim>(asha.client, "claim_chair", { p_chair_id: chairs[0].id, p_secret: chairs[0].secret });
    let all = await seats();
    expect(seat(all, chairs[0].number)).toMatchObject({ state: "seated" });
    expect(seat(all, chairs[0].number).occupant).toBeTruthy();
    expect(seat(all, chairs[1].number).state).toBe("empty");

    const r = await rpcOk<Claim>(ravi.client, "claim_chair", { p_chair_id: chairs[1].id, p_secret: chairs[1].secret });
    await rpcOk(asha.client, "submit_answer", { p_attempt_id: a.attemptId, p_answer: await answerFor(a.question.id, true) });
    await rpcOk(ravi.client, "submit_answer", { p_attempt_id: r.attemptId, p_answer: await answerFor(r.question.id, false) });
    all = await seats();
    expect(all.map((s) => s.state)).toEqual(["seated", "seated"]); // answered, but nothing shown yet

    await rpcOk(admin.client, "close_scan_window");
    expect((await seats()).map((s) => s.state)).toEqual(["seated", "seated"]); // judging, still hidden
  });

  it("only the admin can reveal; then correct is green and wrong is red", async () => {
    expect(await rpcErr(asha.client, "reveal_results")).toBe("NOT_ADMIN");
    expect(await rpcErr(anon(), "reveal_results")).toMatch(/NOT_AUTHENTICATED|NOT_ADMIN|permission denied/);
    await rpcOk(admin.client, "reveal_results");
    const all = await seats();
    expect(seat(all, chairs[0].number).state).toBe("correct");
    expect(seat(all, chairs[1].number).state).toBe("wrong");
    const { data: ps } = await service.from("public_state").select("data").single();
    expect((ps!.data as { spin: { revealed: boolean } }).spin.revealed).toBe(true);
  });

  it("on the next spin the wrong player leaves and the right one stays green", async () => {
    await rpcOk(admin.client, "next_spin");
    const all = await seats();
    expect(seat(all, chairs[0].number).state).toBe("correct");
    expect(seat(all, chairs[1].number)).toMatchObject({ state: "empty", occupant: null });
    // A new spin starts unrevealed.
    const { data: ps } = await service.from("public_state").select("data").single();
    expect((ps!.data as { spin: { revealed: boolean } }).spin.revealed).toBe(false);
  });

  it("nobody but the database can write seats", async () => {
    const { error: e1 } = await anon().from("stage_seats").update({ state: "correct" }).eq("number", chairs[1].number);
    const { error: e2 } = await asha.client.from("stage_seats").update({ state: "correct" }).eq("number", chairs[1].number);
    const { error: e3 } = await asha.client.from("stage_seats").insert({ chair_id: chairs[1].id, number: 99, state: "correct" });
    expect([e1, e2, e3].every(Boolean)).toBe(true);
    expect(seat(await seats(), chairs[1].number).state).toBe("empty");
  });
});
