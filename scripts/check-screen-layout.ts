// Projector layout check: fills every chair on the aimc-test project, opens /screen at projector size in
// headless Chrome and MEASURES the name tags (no screenshots): no two tags may overlap, and none may reach
// into the header or the SCAN NOW / results band. Repeats after the reveal, on the next spin and after a drag.
//
//   npx tsx --env-file=.env.local scripts/check-screen-layout.ts [--size 1280x800]
import { execFileSync, spawn } from "node:child_process";
import { chromium, type Page } from "playwright";
import { rpcOk, service, sleep } from "../integration/harness";
import { setupWorld } from "./sim/driver";

process.env.HARNESS_LOGIN = "otp";
const PORT = 3101;
const SITE = `http://127.0.0.1:${PORT}`;
const CHAIRS = 25;
const sizeArg = process.argv.indexOf("--size");
const [W, H] = (sizeArg > 0 ? process.argv[sizeArg + 1] : "1920x1080").split("x").map(Number);

type Rect = { left: number; right: number; top: number; bottom: number };

async function measure(page: Page, label: string) {
  await sleep(4500); // let seats animate in and tags settle
  // Plain string: tsx would otherwise inject helpers that don't exist in the page.
  const r = (await page.evaluate(`(() => {
    const box = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
    const els = [...document.querySelectorAll("[data-name-tag]")];
    return {
      tags: els.map(box).filter((b) => b.right - b.left > 0),
      header: box(document.querySelector("header")),
      band: box(document.querySelector("[data-stage-band]")),
      texts: els.map((e) => e.innerText + " {" + (e.parentElement ? e.parentElement.style.transform : "") + "}"),
      unmanaged: els.filter((e) => !e.parentElement || e.parentElement.dataset.managed !== "1").map((e) => e.innerText),
    };
  })()`)) as { tags: Rect[]; header: Rect; band: Rect; texts: string[]; unmanaged: string[] };
  if (r.unmanaged.length) console.log(`    not managed by the layout: ${r.unmanaged.join(", ")}`);
  const ov = (a: Rect, b: Rect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  let pairs = 0;
  const fmt = (x: Rect) => `[${Math.round(x.left)}–${Math.round(x.right)} × ${Math.round(x.top)}–${Math.round(x.bottom)}]`;
  r.tags.forEach((a, i) =>
    r.tags.forEach((b, j) => {
      if (i < j && ov(a, b)) {
        pairs++;
        console.log(`    overlap: "${r.texts[i]}" ${fmt(a)} with "${r.texts[j]}" ${fmt(b)} · stage band ${Math.round(r.header.bottom)}–${Math.round(r.band.top)}`);
      }
    }),
  );
  const intoHeader = r.tags.filter((t) => t.top < r.header.bottom - 1).length;
  const intoBand = r.tags.filter((t) => t.bottom > r.band.top + 1).length;
  const cut = r.texts.filter((t) => t.endsWith("…")).length;
  const ok = pairs === 0 && intoHeader === 0 && intoBand === 0 && cut === 0;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${r.tags.length} name tags · overlapping pairs ${pairs} · under header ${intoHeader} · under bottom band ${intoBand} · truncated ${cut}`);
  return ok;
}

async function main() {
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: process.env.TEST_SUPABASE_URL!, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY!, NEXT_PUBLIC_SITE_URL: SITE, NEXT_DIST_DIR: ".next-demo", NEXT_TELEMETRY_DISABLED: "1" };
  execFileSync("npx", ["next", "build"], { env, stdio: "ignore" });
  const server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], { env, stdio: "ignore" });
  let allOk = true;
  try {
    for (let i = 0; i < 120; i++) {
      try {
        if ((await fetch(`${SITE}/screen`)).ok) break;
      } catch {}
      await sleep(500);
    }
    const { admin, bots } = await setupWorld(CHAIRS + 3);
    // Long, realistic names: the worst case for wrapping and overlaps.
    const names = ["Krishnamurthy Venkatesh", "Ananya Rao", "Mohammed Faizan Ahmed", "Sowmya Lakshminarayan", "R. Pranav", "Thejaswini Gowda", "Siddharth Narayanaswamy", "Keerthana B S"];
    for (const [i, b] of bots.entries()) await service.from("players").update({ name: names[i % names.length] + (i >= names.length ? ` ${i}` : "") }).eq("id", b.playerId);
    await rpcOk(admin.client, "create_chairs", { p_count: CHAIRS });
    const { data: chairs } = await service.from("chairs").select("id, secret").is("deleted_at", null).order("number");

    const browser = await chromium.launch({ channel: "chromium", args: ["--ignore-gpu-blocklist", "--use-angle=metal"] });
    const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
    console.log(`Projector size ${W}×${H}`);
    await page.goto(`${SITE}/screen`);
    await rpcOk(admin.client, "start_round");
    await rpcOk(admin.client, "open_scan_window");
    await Promise.all(chairs!.map((c, i) => rpcOk(bots[i].client, "claim_chair", { p_chair_id: c.id, p_secret: c.secret })));
    allOk = (await measure(page, `SCAN NOW, all ${CHAIRS} chairs seated`)) && allOk;

    const { data: att } = await service.from("attempts").select("id, player_id, question_id").eq("result", "pending");
    await Promise.all(att!.map(async (a, i) => {
      const bot = bots.find((b) => b.playerId === a.player_id)!;
      const { data: q } = await service.from("questions").select("type, options, answer").eq("id", a.question_id).single();
      const right = q!.type === "mcq" ? String((q!.options as string[]).indexOf(q!.answer)) : q!.answer;
      await rpcOk(bot.client, "submit_answer", { p_attempt_id: a.id, p_answer: i % 3 === 0 ? "nope-wrong" : right });
    }));
    await rpcOk(admin.client, "close_scan_window");
    await rpcOk(admin.client, "reveal_results");
    allOk = (await measure(page, "Results shown (green / red)")) && allOk;

    const stage = page.locator("main > div.cursor-grab");
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 420, box.y + box.height / 2 - 160, { steps: 20 });
    await page.mouse.up();
    allOk = (await measure(page, "After dragging the stage (rotate + tilt)")) && allOk;
    const cam = await page.evaluate(() => document.querySelector("canvas") !== null);
    console.log(`${cam ? "✓" : "✗"} drag handled without errors`);

    await rpcOk(admin.client, "next_spin");
    allOk = (await measure(page, "Next spin: WALK! (red players left)")) && allOk;
    await browser.close();
  } finally {
    server.kill();
    await service.from("games").update({ status: "lobby", current_round_id: null }).eq("id", 1);
  }
  console.log(allOk ? "LAYOUT OK" : "LAYOUT PROBLEMS");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
