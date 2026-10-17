// Bot simulation (T-801): N bot players and an admin bot play full games on the aimc-test project, with every
// rule checked at each step (scripts/sim/driver.ts). Run 1 uses the given schedule; later runs use random
// admin-style schedules with chairs added and deleted between rounds.
//
//   npx tsx --env-file=.env.local scripts/simulate.ts --bots 30 --schedule 25,15,8,3 --runs 5
//
// Never touches production: the harness refuses to run when TEST_SUPABASE_URL is the app's own project.
import { mkdirSync, writeFileSync } from "node:fs";
import { deleteCreatedUsers, service } from "../integration/harness";
import { FAST, InvariantError, playGame, setupWorld, type RunReport } from "./sim/driver";

// Bots start sessions through one-time links (Auth verify bucket), leaving the per-IP sign-in budget for people.
process.env.HARNESS_LOGIN ??= "otp";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const botCount = Number(args.get("bots") ?? 30);
const firstSchedule = (args.get("schedule") ?? "25,15,8,3").split(",").map(Number);
const runs = Number(args.get("runs") ?? 5);
const seed = Number(args.get("seed") ?? Date.now() % 100000);
const report = args.get("report") ?? "docs/reports/simulation.md";

/** A random decreasing schedule that ends on a final round of 1–3 chairs and always has fewer chairs than players. */
function randomSchedule(players: number, rand: () => number): number[] {
  const out: number[] = [];
  let chairs = Math.max(4, Math.min(players - 1, Math.round(players * (0.55 + rand() * 0.3))));
  while (chairs > 3) {
    out.push(chairs);
    chairs = Math.max(3, Math.floor(chairs * (0.4 + rand() * 0.3)));
  }
  out.push(1 + Math.floor(rand() * 3));
  return out;
}

function rng(s: number) {
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

async function main() {
  const rand = rng(seed);
  const results: { run: number; schedule: number[]; report?: RunReport; error?: string }[] = [];
  console.log(`Simulation: ${botCount} bots, ${runs} run(s), seed ${seed}`);
  for (let run = 1; run <= runs; run++) {
    const schedule = run === 1 ? firstSchedule : randomSchedule(botCount, rand);
    console.log(`\n── Run ${run}/${runs} · chairs ${schedule.join(" → ")}`);
    try {
      const { admin } = await setupWorld(botCount);
      const r = await playGame(admin, {
        bots: botCount,
        schedule,
        correctRate: 0.7,
        noAnswerRate: 0.05,
        randomChairOps: run > 1,
        pace: FAST,
        seed: seed + run,
        log: (l) => console.log("  " + l),
      });
      results.push({ run, schedule, report: r });
      console.log(`  ✓ ${r.checks} checks passed in ${(r.durationMs / 1000).toFixed(1)} s · claim latency p50 ${r.claimLatencyMs.p50} ms, p95 ${r.claimLatencyMs.p95} ms`);
    } catch (e) {
      const msg = e instanceof InvariantError ? `RULE BROKEN: ${e.message}` : e instanceof Error ? e.message : String(e);
      results.push({ run, schedule, error: msg });
      console.error(`  ✗ ${msg}`);
    }
  }
  await deleteCreatedUsers();
  // Leave the test project in a clean lobby.
  await service.from("games").update({ status: "lobby", current_round_id: null }).eq("id", 1);

  const ok = results.filter((x) => x.report);
  const lines = [
    "# Bot simulation report (T-801)",
    "",
    `Generated ${new Date().toISOString()} by \`scripts/simulate.ts\` against the aimc-test project. ${botCount} bot players + 1 admin bot, seed ${seed}.`,
    "",
    "| Run | Chairs per round | Rounds | Spins | Claims | Contested chairs | Right | Wrong | Timed out | Eliminated | Winners | Checks | Claim p50 / p95 / max | Time | Result |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...results.map((x) =>
      x.report
        ? `| ${x.run} | ${x.schedule.join(" → ")} | ${x.report.rounds} | ${x.report.spins} | ${x.report.claims} | ${x.report.contested} | ${x.report.correct} | ${x.report.wrong} | ${x.report.timedOut} | ${x.report.eliminated} | ${x.report.winners.length} | ${x.report.checks} | ${x.report.claimLatencyMs.p50} / ${x.report.claimLatencyMs.p95} / ${x.report.claimLatencyMs.max} ms | ${(x.report.durationMs / 1000).toFixed(1)} s | ✅ green |`
        : `| ${x.run} | ${x.schedule.join(" → ")} | – | – | – | – | – | – | – | – | – | – | – | – | ❌ ${x.error} |`,
    ),
    "",
    "Checked at every step: one winner per contested chair and no other claim errors; a scan seats its player on the projector at once; the projector never shows red before the admin reveals; green seats equal locked chairs and red seats equal wrong/timed-out answers after the reveal; red players leave and green stay on the next spin; survivors are exactly the chair holders; the final round crowns exactly its chair count with podium ranks 1..n.",
    "",
    `**${ok.length}/${results.length} runs green.**`,
    "",
  ];
  mkdirSync("docs/reports", { recursive: true });
  writeFileSync(report, lines.join("\n"));
  console.log(`\n${ok.length}/${results.length} runs green · report: ${report}`);
  process.exit(ok.length === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
