// T15 gate: nothing secret may reach the browser. Scans the built client assets (.next/static) and every
// git-tracked file for the actual secret values from .env.local and for secret-shaped tokens.
// Run after `npm run build`:  node --env-file=.env.local scripts/check-bundle-secrets.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.env.NEXT_DIST_DIR || ".next";
const staticDir = join(dist, "static");
if (!existsSync(staticDir)) {
  console.error(`No ${staticDir}. Run npm run build first.`);
  process.exit(1);
}

// Real secret values (never printed): server-only env vars that must not appear anywhere public.
const secretValues = ["GEMINI_API_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  .map((k) => [k, process.env[k]])
  .filter(([, v]) => v && v.length >= 16);

// Secret-shaped tokens: Supabase secret keys, service-role JWTs, Google API keys, private keys.
const patterns = [
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{10,}/],
  ["service_role JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*?c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const problems = [];
function scan(file, where) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const [name, value] of secretValues) if (text.includes(value)) problems.push(`${where}: contains the value of ${name}`);
  for (const [name, re] of patterns) if (re.test(text)) problems.push(`${where}: contains a ${name}`);
}

let clientFiles = 0;
for (const f of walk(staticDir)) {
  clientFiles++;
  scan(f, f);
}
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const textLike = tracked.filter((f) => !/\.(glb|png|jpe?g|webp|ico|woff2?|mp4|webm)$/i.test(f));
for (const f of textLike) scan(f, `git:${f}`);

if (problems.length) {
  console.error(`SECRETS FOUND (${problems.length}):\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`No secrets: ${clientFiles} client files and ${textLike.length} tracked files checked against ${secretValues.length} secret values and ${patterns.length} patterns`);
