import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_SUPABASE_URL;
const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error("TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}
if (url.includes(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "\u0000")) {
  throw new Error("Refusing to run integration tests against the production project");
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: test setup and assertions only (bypasses RLS). */
export const service = createClient(url, serviceKey, noSession);

export const anon = () => createClient(url, anonKey, noSession);

const createdUsers: string[] = [];

export type Actor = { client: SupabaseClient; userId: string; email: string };

/** Creates a confirmed auth user and returns a client signed in as them. */
export async function signedInUser(label: string): Promise<Actor> {
  const email = `itest-${label}-${randomUUID().slice(0, 8)}@aimc-test.dev`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUsers.push(data.user.id);
  const client = anon();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { client, userId: data.user.id, email };
}

export async function makeAdmin(label = "admin"): Promise<Actor> {
  const actor = await signedInUser(label);
  const { error } = await service.from("admins").insert({ user_id: actor.userId });
  if (error) throw error;
  return actor;
}

let usnCounter = 0;
const runSalt = String(Math.floor(Math.random() * 900) + 100);
/** Registers a player through the real RPC with valid unique details. */
export async function makePlayer(label: string): Promise<Actor & { usn: string }> {
  const actor = await signedInUser(label);
  usnCounter++;
  const n = String(usnCounter).padStart(6, "0");
  const usn = `4SUT${runSalt}${n.slice(-3)}`;
  const phone = `9${runSalt}${n}`;
  const name = `Player ${String.fromCharCode(65 + (usnCounter % 26))}${String.fromCharCode(97 + ((usnCounter * 7) % 26))}`;
  await rpcOk(actor.client, "register_player", { p_name: name, p_usn: usn, p_phone: phone, p_branch: "CSE" });
  return { ...actor, usn };
}

export async function rpcOk<T = unknown>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data as T;
}

/** Calls an RPC that must fail, returning the error code (the message). */
export async function rpcErr(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<string> {
  const { error } = await client.rpc(fn, args);
  if (!error) throw new Error(`${fn} unexpectedly succeeded`);
  return error.message;
}

/** Wipes game state and test-created chairs/questions; leaves the schema intact. */
export async function resetWorld() {
  const steps = [
    service.from("games").update({ current_round_id: null, status: "lobby", registration_open: true, final_chair_count: 3, timer_seconds: 30 }).eq("id", 1),
    service.from("alerts").delete().gte("id", 0),
    service.from("attempts").delete().not("id", "is", null),
    service.from("spins").delete().not("id", "is", null),
    service.from("rounds").delete().not("id", "is", null),
    service.from("chairs").delete().not("id", "is", null),
    service.from("questions").delete().eq("topic", "itest"),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) throw error;
  }
}

export async function deleteCreatedUsers() {
  for (const id of createdUsers.splice(0)) {
    await service.auth.admin.deleteUser(id);
  }
}

/** Known questions so tests can answer right or wrong on purpose. */
export async function seedTestQuestions(count = 40) {
  const rows = Array.from({ length: count }, (_, i) => ({
    text: `Integration question ${i + 1}: pick the option "right"`,
    type: i % 2 === 0 ? "mcq" : "one_word",
    options: i % 2 === 0 ? ["wrong", "right", "nope", "nah"] : null,
    answer: "right",
    alternatives: i % 2 === 0 ? [] : ["correct"],
    difficulty: (i % 5) + 1,
    topic: "itest",
    source: "seed",
  }));
  const { error } = await service.from("questions").insert(rows);
  if (error) throw error;
}

/** Looks up the real answer (service role) and returns what to submit to be right or wrong. */
export async function answerFor(questionId: string, correct: boolean): Promise<string> {
  const { data, error } = await service.from("questions").select("type, options, answer").eq("id", questionId).single();
  if (error || !data) throw error ?? new Error("question not found");
  if (data.type === "mcq") {
    const options = data.options as string[];
    const right = options.indexOf(data.answer);
    return String(correct ? right : (right + 1) % options.length);
  }
  return correct ? `  ${String(data.answer).toUpperCase()} ` : "definitely-not-the-answer";
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
