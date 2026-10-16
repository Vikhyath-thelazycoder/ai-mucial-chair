import "server-only";

import mammoth from "mammoth";
import { isAdmin } from "@/lib/admin/session";
import { getServerSupabase } from "@/lib/supabase/server";
import { askGemini, geminiConfigured } from "./gemini";
import type { AiDeps } from "./handlers";

/** Real dependencies for the AI routes: the caller's Supabase session, the rate-limit RPC and Gemini. */
export async function routeDeps(): Promise<AiDeps> {
  const supabase = await getServerSupabase();
  return {
    role: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return "none";
      return (await isAdmin(supabase)) ? "admin" : "user";
    },
    logRequest: async () => {
      const { error } = await supabase.rpc("log_ai_request");
      return error ? error.message : null;
    },
    gemini: geminiConfigured() ? askGemini : null,
    docxToText: async (bytes) => (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value,
  };
}

/** Defence in depth against cross-site POSTs (auth cookies are SameSite=Lax already). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
