// Creates a player's auth account (D-015): pre-confirmed, so no email is ever sent.
// Input: { usn, pin }. Output: { status: "created" | "exists" }. The browser then signs in with USN + PIN.
// The service-role key is injected by Supabase and never leaves this function.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const EMAIL_DOMAIN = "players.aimusicalchair.app";
const USN = /^[0-9A-Z]{6,12}$/;
const PIN = /^[0-9]{6}$/;

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405, origin);

  let body: { usn?: unknown; pin?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ code: "VALIDATION" }, 422, origin);
  }
  const usn = typeof body.usn === "string" ? body.usn.trim().toUpperCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!USN.test(usn) || !PIN.test(pin)) return json({ code: "VALIDATION" }, 422, origin);

  const { error } = await admin.auth.admin.createUser({
    email: `${usn.toLowerCase()}@${EMAIL_DOMAIN}`,
    password: pin,
    email_confirm: true,
  });
  if (!error) return json({ status: "created" }, 200, origin);
  if (error.code === "email_exists" || /already been registered|already exists/i.test(error.message)) {
    return json({ status: "exists" }, 200, origin);
  }
  console.error("player-signup failed", error.code);
  return json({ code: "SERVER" }, 500, origin);
});
