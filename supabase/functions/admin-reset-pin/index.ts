// Admin-only: set a new 6-digit PIN for a player's account (forgotten PIN, SECURITY.md T17).
// Input: { playerId, pin } with the admin's access token as Authorization: Bearer <token>.
// The caller is verified here (signed-in AND listed in public.admins); the service key is injected by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const PIN = /^[0-9]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CORS is not a security boundary here: anyone can call these endpoints outside a browser. player-signup only
// creates pre-confirmed accounts from valid input; admin-reset-pin authenticates with a bearer token (no cookies).
// Allowing any origin means the Vercel domain (and previews) work without extra configuration.
function cors(_origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405, origin);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller.user) return json({ code: "NOT_AUTHENTICATED" }, 401, origin);
  const { data: isAdmin } = await admin.from("admins").select("user_id").eq("user_id", caller.user.id).maybeSingle();
  if (!isAdmin) return json({ code: "NOT_ADMIN" }, 403, origin);

  let body: { playerId?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ code: "VALIDATION" }, 422, origin);
  }
  if (typeof body.playerId !== "string" || !UUID.test(body.playerId) || typeof body.pin !== "string" || !PIN.test(body.pin)) {
    return json({ code: "VALIDATION" }, 422, origin);
  }

  const { data: player } = await admin.from("players").select("user_id").eq("id", body.playerId).maybeSingle();
  if (!player) return json({ code: "NOT_FOUND" }, 404, origin);

  const { error } = await admin.auth.admin.updateUserById(player.user_id, { password: body.pin });
  if (error) {
    console.error("admin-reset-pin failed", error.code);
    return json({ code: "SERVER" }, 500, origin);
  }
  await admin.from("admin_audit").insert({ admin_id: caller.user.id, action: "reset_pin", target: body.playerId, reason: "PIN reset" });
  return json({ status: "updated" }, 200, origin);
});
