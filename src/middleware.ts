import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { stripChairSecret } from "@/lib/security/chairLink";
import { buildCsp } from "@/lib/security/csp";

export async function middleware(request: NextRequest) {
  const clean = stripChairSecret(request.nextUrl);
  if (clean) return NextResponse.redirect(clean, 307);

  let env: ReturnType<typeof publicEnv>;
  try {
    env = publicEnv();
  } catch (e) {
    return misconfigured(e);
  }
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp({
    nonce,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    dev: process.env.NODE_ENV === "development",
  });

  // Next.js reads the nonce from the request's CSP header and applies it to its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresh the Supabase session cookie on every request.
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * A missing or malformed env var used to crash every request (MIDDLEWARE_INVOCATION_FAILED). Show which
 * variables are wrong instead. The message lists variable names and rules only, never values.
 */
function misconfigured(e: unknown) {
  const detail = e instanceof Error ? e.message : "Invalid environment variables";
  const html = `<!doctype html><meta charset="utf-8"><title>Setup needed</title><body style="font-family:system-ui;background:#07070C;color:#F2F4FF;padding:32px;max-width:720px;margin:auto"><h1>AI Musical Chair needs setup</h1><p>The server's environment variables are missing or invalid:</p><pre style="white-space:pre-wrap;background:#11121C;padding:16px;border-radius:12px">${detail.replace(/[<>&]/g, "")}</pre><p>Set them in your hosting dashboard (Vercel → Settings → Environment Variables), then <b>redeploy</b>. Variables starting with NEXT_PUBLIC_ only take effect after a new build.</p></body>`;
  return new NextResponse(html, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|models/).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
