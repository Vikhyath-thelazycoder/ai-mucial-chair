import type { SupabaseClient } from "@supabase/supabase-js";
import type { MyStatus } from "@/lib/game/types";
import { playerEmail, type Login, type Registration } from "./validation";

export class PlayerAuthError extends Error {}

function raise(message: string): never {
  throw new PlayerAuthError(message);
}

async function joinCurrentGame(client: SupabaseClient, r: Omit<Registration, "pin">) {
  const { error } = await client.rpc("register_player", {
    p_name: r.name,
    p_usn: r.usn,
    p_phone: r.phone,
    p_branch: r.branch,
  });
  // Already in this game (e.g. a double tap): that's success.
  if (error && error.message !== "ALREADY_REGISTERED") raise(error.message);
}

/**
 * First-time or returning player: creates the account (USN + PIN) or signs into the existing one,
 * then joins the current game. Returning students from an earlier game reuse their PIN.
 */
export async function registerPlayer(client: SupabaseClient, r: Registration) {
  // Accounts are created server-side, pre-confirmed, so no email is ever sent (D-015).
  const { data, error } = await client.functions.invoke<{ status: "created" | "exists" }>("player-signup", {
    body: { usn: r.usn, pin: r.pin },
  });
  if (error || !data) raise(error ? "network" : "SERVER");
  const signIn = await client.auth.signInWithPassword({ email: playerEmail(r.usn), password: r.pin });
  if (signIn.error) {
    // The USN already had an account and this isn't its PIN.
    raise(data.status === "exists" ? "User already registered" : signIn.error.message);
  }
  await joinCurrentGame(client, r);
}

/** Already signed in (played an earlier game): join the current one with fresh details. */
export async function rejoinCurrentGame(client: SupabaseClient, r: Omit<Registration, "pin">) {
  await joinCurrentGame(client, r);
}

export async function loginPlayer(client: SupabaseClient, l: Login) {
  const { error } = await client.auth.signInWithPassword({ email: playerEmail(l.usn), password: l.pin });
  if (error) raise(error.message);
}

export async function fetchMyStatus(client: SupabaseClient): Promise<MyStatus> {
  const { data, error } = await client.rpc("my_status");
  if (error) raise(error.message);
  return data as MyStatus;
}

/** The player's details from their most recent game, to prefill the re-join form. */
export async function lastDetails(client: SupabaseClient): Promise<Omit<Registration, "pin"> | null> {
  const { data } = await client
    .from("players")
    .select("name, usn, phone, branch")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
