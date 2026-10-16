// Loads supabase/seed/questions.csv into the TEST project (skips questions already present).
// Production questions are imported by the admin through the CSV upload (P5).
//   npx tsx scripts/seed-questions.mts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { loadEnv } from "vite";
import { parseQuestionsCsv } from "../src/lib/questions/csv.ts";

const env = loadEnv("", process.cwd(), "TEST_");
if (!env.TEST_SUPABASE_URL || !env.TEST_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY are required in .env.local");
}

const { questions, errors } = parseQuestionsCsv(readFileSync("supabase/seed/questions.csv", "utf8"));
if (errors.length) {
  console.error(errors);
  process.exit(1);
}

const db = createClient(env.TEST_SUPABASE_URL, env.TEST_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existing, error } = await db.from("questions").select("text");
if (error) throw error;
const known = new Set(existing.map((q) => q.text));
const fresh = questions.filter((q) => !known.has(q.text)).map((q) => ({ ...q, source: "seed" }));

if (fresh.length) {
  const { error: insertError } = await db.from("questions").insert(fresh);
  if (insertError) throw insertError;
}
console.log(`seeded ${fresh.length} new questions (${questions.length - fresh.length} already present)`);
