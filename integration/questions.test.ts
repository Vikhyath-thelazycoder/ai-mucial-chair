// P5: saving reviewed questions and the AI rate limit, against aimc-test.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteCreatedUsers, makeAdmin, makePlayer, resetWorld, rpcErr, rpcOk, service, type Actor } from "./harness";

const salt = Date.now().toString(36);
const q = (n: number, over: Record<string, unknown> = {}) => ({
  text: `Import test ${salt} question ${n}?`,
  type: "mcq",
  options: ["alpha", "beta", "gamma"],
  answer: "beta",
  alternatives: [],
  difficulty: 2,
  topic: "itest",
  ...over,
});

let admin: Actor;
let player: Actor;

beforeAll(async () => {
  await resetWorld();
  admin = await makeAdmin();
  player = await makePlayer("q-player");
});

afterAll(async () => {
  await service.from("questions").delete().like("text", `Import test ${salt}%`);
  await service.from("ai_requests").delete().eq("admin_id", admin.userId);
  await resetWorld();
  await deleteCreatedUsers();
});

describe("import_questions", () => {
  it("only admins can import", async () => {
    expect(await rpcErr(player.client, "import_questions", { p_questions: [q(1)], p_source: "ai" })).toBe("NOT_ADMIN");
  });

  it("inserts valid questions, skips duplicates (any case) and counts invalid ones", async () => {
    const res = await rpcOk(admin.client, "import_questions", {
      p_questions: [
        q(1),
        q(2, { type: "one_word", options: null, answer: "Kernel", alternatives: ["kernal"] }),
        q(1, { text: `IMPORT TEST ${salt} QUESTION 1?` }), // same text, different case
        q(3, { answer: "delta" }), // MCQ answer not among options
        q(4, { difficulty: 9 }),
      ],
      p_source: "ai",
    });
    expect(res).toEqual({ inserted: 2, duplicates: 1, invalid: 2 });
    const { data } = await service.from("questions").select("source, alternatives").like("text", `Import test ${salt}%`).order("text");
    expect(data).toEqual([
      { source: "ai", alternatives: [] },
      { source: "ai", alternatives: ["kernal"] },
    ]);
  });

  it("re-importing the same file adds nothing", async () => {
    const res = await rpcOk(admin.client, "import_questions", { p_questions: [q(1), q(2)], p_source: "csv" });
    expect(res).toMatchObject({ inserted: 0, duplicates: 2 });
  });

  it("rejects an unknown source", async () => {
    expect(await rpcErr(admin.client, "import_questions", { p_questions: [q(5)], p_source: "seed" })).toBe("VALIDATION");
  });

  it("players still can't read the answers", async () => {
    const { data } = await player.client.from("questions").select("answer").like("text", `Import test ${salt}%`);
    expect(data ?? []).toEqual([]);
  });
});

describe("log_ai_request", () => {
  it("allows 10 AI calls per admin per minute, then rate-limits; players can't call it", async () => {
    await service.from("ai_requests").delete().eq("admin_id", admin.userId);
    for (let i = 0; i < 10; i++) await rpcOk(admin.client, "log_ai_request");
    expect(await rpcErr(admin.client, "log_ai_request")).toBe("RATE_LIMITED");
    expect(await rpcErr(player.client, "log_ai_request")).toBe("NOT_ADMIN");
  });
});
