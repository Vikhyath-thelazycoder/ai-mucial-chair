import { z } from "zod";

const publicSchema = z.object({
  // Optional: when unset, QR codes use the address the admin panel is open on (the live site on Vercel).
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1)
    .refine((k) => !k.startsWith("sb_secret_"), "must be the publishable key, never a secret key"),
  NEXT_PUBLIC_SPOTIFY_CLIENT_ID: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

/** Forgives the usual copy-paste slips in hosting dashboards: surrounding spaces, quotes, a trailing slash. */
function clean(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/^["']+|["']+$/g, "").trim();
  return v ? v : undefined;
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const cleaned = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, clean(v)]));
  if (cleaned.NEXT_PUBLIC_SITE_URL) cleaned.NEXT_PUBLIC_SITE_URL = cleaned.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const result = publicSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}\nSee .env.example.`);
  }
  return result.data;
}

// NEXT_PUBLIC_* values are inlined at build time, so they must be read by their literal names.
export const publicEnv = (): PublicEnv =>
  parsePublicEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SPOTIFY_CLIENT_ID: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
  });

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"];

/**
 * The public address players use: the configured site URL when it's a real (non-local) address,
 * otherwise the address this page is open on. On Vercel both point at the live site.
 */
export function siteUrl(): string {
  let configured: string | undefined;
  try {
    configured = publicEnv().NEXT_PUBLIC_SITE_URL;
  } catch {
    configured = undefined;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (configured && !LOCAL_HOSTS.includes(new URL(configured).hostname)) return configured;
  return origin || configured || "";
}
