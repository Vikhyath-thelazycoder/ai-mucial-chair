import { z } from "zod";

// Mirrors the CHECK constraints on public.players (0001_schema.sql), so players get instant feedback.
// The database remains the authority.

export const PLAYER_EMAIL_DOMAIN = "players.aimusicalchair.app";

/** Players sign in with USN + PIN; Supabase Auth needs an email, so we derive one that never receives mail. */
export const playerEmail = (usn: string) => `${usn.trim().toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`;

const usn = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9A-Z]{6,12}$/, "USN should be 6–12 letters and numbers, e.g. 4SU22CS011");

const pin = z.string().regex(/^[0-9]{6}$/, "PIN must be exactly 6 digits");

export const registrationSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Enter your name")
        .max(40, "Name is too long")
        .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters, spaces, dots, hyphens or apostrophes"),
    ),
  usn,
  phone: z.string().trim().regex(/^[0-9]{10}$/, "Phone must be 10 digits"),
  branch: z.string().trim().min(1, "Enter your branch").max(40, "Branch is too long"),
  pin,
});

export type Registration = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({ usn, pin });
export type Login = z.infer<typeof loginSchema>;

/** Field → first error message, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    out[key] ??= issue.message;
  }
  return out;
}
