// WiFi sign-in check (T-8.1): N phones behind one campus WiFi share one public IP. This creates N player
// accounts the way player-signup does (USN email + 6-digit PIN), then signs them all in at once from this
// machine (one IP) against the aimc-test project and records how many get through before Auth rate-limits.
//
//   npx tsx --env-file=.env.local scripts/signin-burst.ts --phones 35
import { mkdirSync, writeFileSync } from "node:fs";
import { anon, service } from "../integration/harness";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const phones = Number(args.get("phones") ?? 35);
const report = args.get("report") ?? "docs/reports/wifi-signin.md";

async function main() {
  const salt = String(Date.now()).slice(-4);
  const accounts = Array.from({ length: phones }, (_, i) => ({
    email: `4wifi${salt}${String(i).padStart(3, "0")}@players.aimusicalchair.app`,
    pin: String(100000 + Math.floor(Math.random() * 900000)),
    id: "",
  }));
  for (const a of accounts) {
    const { data, error } = await service.auth.admin.createUser({ email: a.email, password: a.pin, email_confirm: true });
    if (error) throw error;
    a.id = data.user!.id;
  }

  const t0 = Date.now();
  const results = await Promise.all(
    accounts.map(async (a) => {
      const t = Date.now();
      const { error } = await anon().auth.signInWithPassword({ email: a.email, password: a.pin });
      return { ok: !error, limited: Boolean(error && /rate limit/i.test(error.message)), error: error?.message ?? null, ms: Date.now() - t };
    }),
  );
  const elapsed = Date.now() - t0;
  for (const a of accounts) await service.auth.admin.deleteUser(a.id);

  const ok = results.filter((r) => r.ok).length;
  const limited = results.filter((r) => r.limited).length;
  const other = results.filter((r) => !r.ok && !r.limited);
  const slowest = Math.max(...results.map((r) => r.ms));
  const lines = [
    "# WiFi sign-in check (T-8.1)",
    "",
    `Generated ${new Date().toISOString()} by \`scripts/signin-burst.ts\` against the aimc-test project.`,
    "",
    `${phones} phones signed in at the same moment from one IP address (as on shared campus WiFi).`,
    "",
    "| Phones | Signed in | Rate-limited | Other errors | Burst time | Slowest sign-in |",
    "|---|---|---|---|---|---|",
    `| ${phones} | ${ok} | ${limited} | ${other.length} | ${elapsed} ms | ${slowest} ms |`,
    "",
    limited > 0
      ? `**Result: the default Supabase Auth limit blocked ${limited} of ${phones} phones.** Supabase allows 30 sign-ups + sign-ins per IP per 5 minutes by default (\`auth.rate_limit.sign_in_sign_ups\`). At the fest every phone on the campus WiFi shares one public IP, so the 31st player to register or log in within 5 minutes is refused.`
      : `**Result: all ${phones} phones signed in.** The project's sign-in limit is above ${phones} per IP per 5 minutes.`,
    "",
    "## What to change before the fest",
    "",
    "On the **live** Supabase project: Dashboard → Authentication → Rate Limits → **Sign-ups and sign-ins** → raise from 30 to at least **300 per 5 minutes** (one registration + one login per student, with headroom for retries and PIN typos). Leave token refresh and other limits as they are. Re-run this script against a project with the new limit to confirm.",
    "",
    "Trade-off (SECURITY.md T10): a higher per-IP limit makes PIN guessing from the campus network easier, but each guess still needs a valid USN and the event lasts one day; hosts can reset a PIN from the admin panel.",
    "",
    other.length ? `Other errors seen: ${[...new Set(other.map((r) => r.error))].join("; ")}` : "No other errors.",
    "",
  ];
  mkdirSync("docs/reports", { recursive: true });
  writeFileSync(report, lines.join("\n"));
  console.log(`${ok}/${phones} signed in, ${limited} rate-limited, ${other.length} other errors · report: ${report}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
