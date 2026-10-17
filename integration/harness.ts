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
  await withAuthRetry(() => startSession(client, email, password));
  return { client, userId: data.user.id, email };
}

/** Auth rate limits are per IP per 5 minutes: wait them out (up to 8 min) instead of failing a whole run. */
async function withAuthRetry(fn: () => Promise<void>) {
  const until = Date.now() + 8 * 60_000;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof Error && /rate limit/i.test(e.message)) || Date.now() > until) throw e;
      await sleep(20_000);
    }
  }
}

async function startSession(client: SupabaseClient, email: string, password: string) {
  if (process.env.HARNESS_LOGIN === "otp") {
    // Bots (scripts/sim): a one-time link verified by the client draws on Auth's verify bucket instead of the
    // sign-in bucket (30 per 5 minutes per IP), leaving sign-ins for the real login screens in the demo.
    const link = await service.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const verify = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
    if (verify.error) throw verify.error;
  } else {
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  }
}

// Supabase Auth rate-limits sign-ins per IP, so players and the admin are pooled: each pooled account signs in
// once per run and is reused by every test file (vitest runs them in one module context, isolate: false).
// resetWorld() opens a fresh game session, so pooled accounts start each file unregistered.
const pool: Actor[] = [];
let poolUsed = 0;
let adminActor: Actor | null = null;

async function pooledActor(label: string): Promise<Actor> {
  if (poolUsed < pool.length) return pool[poolUsed++];
  const actor = await signedInUser(`pool-${label}`);
  pool.push(actor);
  poolUsed++;
  return actor;
}

// The label is kept so call sites read clearly; the admin is a single pooled account.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function makeAdmin(_label = "admin"): Promise<Actor> {
  if (!adminActor) {
    adminActor = await signedInUser("admin");
    const { error } = await service.from("admins").insert({ user_id: adminActor.userId });
    if (error) throw error;
  }
  return adminActor;
}

let usnCounter = 0;
const runSalt = String(Math.floor(Math.random() * 900) + 100);
/** Registers a player through the real RPC with valid unique details. */
export async function makePlayer(label: string): Promise<Actor & { usn: string }> {
  const actor = await pooledActor(label);
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

export async function currentSessionId(): Promise<string> {
  const { data, error } = await service.from("games").select("current_session_id").single();
  if (error) throw error;
  return data.current_session_id as string;
}

/** The account's player row in the CURRENT game (pooled accounts have rows in earlier games too). */
export async function currentPlayer<T = Record<string, unknown>>(userId: string, columns: string): Promise<T> {
  const { data, error } = await service
    .from("players")
    .select(columns)
    .eq("user_id", userId)
    .eq("session_id", await currentSessionId())
    .single();
  if (error) throw error;
  return data as T;
}

/** Calls an RPC that must fail, returning the error code (the message). */
export async function rpcErr(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<string> {
  const { error } = await client.rpc(fn, args);
  if (!error) throw new Error(`${fn} unexpectedly succeeded`);
  return error.message;
}

/** Deletes test accounts left behind by an earlier run that crashed before its cleanup. */
async function purgeStaleTestUsers() {
  for (let page = 1; page < 20; page++) {
    const { data } = await service.auth.admin.listUsers({ page, perPage: 200 });
    const stale = (data?.users ?? []).filter((u) => u.email?.startsWith("itest-") && !createdUsers.includes(u.id));
    for (const u of stale) await service.auth.admin.deleteUser(u.id);
    if (!data || data.users.length < 200) break;
  }
}

/**
 * Wipes game state and test-created chairs/questions, removes stale test users, and moves the game to a
 * fresh session so every test file starts with an empty roster. Leaves the schema intact.
 */
export async function resetWorld() {
  await purgeStaleTestUsers();
  poolUsed = 0;
  const { data: last } = await service.from("game_sessions").select("number").order("number", { ascending: false }).limit(1).single();
  const { data: session, error: sessionError } = await service
    .from("game_sessions")
    .insert({ number: (last?.number ?? 0) + 1, name: "Integration test" })
    .select("id")
    .single();
  if (sessionError) throw sessionError;
  const steps = [
    service.from("games").update({ current_session_id: session.id, current_round_id: null, status: "lobby", registration_open: true, final_chair_count: 3, timer_seconds: 30 }).eq("id", 1),
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

/** Deletes the accounts this file created; pooled accounts live for the whole run (purged on the next run). */
export async function deleteCreatedUsers() {
  const keep = new Set([...pool.map((a) => a.userId), adminActor?.userId]);
  for (let i = createdUsers.length - 1; i >= 0; i--) {
    const id = createdUsers[i];
    if (keep.has(id)) continue;
    createdUsers.splice(i, 1);
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
