import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when the signed-in user is listed in public.admins. RLS only returns your own admins row,
 * and only if you are an admin, so a non-empty result is proof.
 */
export async function isAdmin(client: SupabaseClient): Promise<boolean> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return false;
  const { data } = await client.from("admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  return Boolean(data);
}
