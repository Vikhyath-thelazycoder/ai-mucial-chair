// Demo video (Phase 8): one real game on the aimc-test project, recorded side by side from the admin console,
// the projector and one player's phone, then joined into a single 1920×1080 MP4 (demo/, git-ignored).
//
// The admin console is driven through its real buttons and shortcuts; the phone registers through the real
// form and scans chair 1 with the real scanner (Chromium's fake camera plays a video of that chair's QR); the
// other players are bots from scripts/sim/driver.ts, which also checks every game rule as it goes.
//
//   npx tsx --env-file=.env.local scripts/record-demo.ts
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import QRCode from "qrcode";
import { rpcOk, service, sleep, type Actor } from "../integration/harness";
import { playGame, setupWorld, type AdminAction } from "./sim/driver";
import { chairUrl } from "../src/lib/qr";

process.env.HARNESS_LOGIN = "otp"; // bots skip the sign-in bucket; the real login screens use it
const PORT = 3100;
const SITE = `http://127.0.0.1:${PORT}`;
const OUT = resolve("demo");
const WORK = join(OUT, "work");
const BOTS = 29; // + the phone player = 30 players
const SCHEDULE = [25, 15, 8, 3];
const ADMIN_EMAIL = "itest-demo-admin@aimc-test.dev";
const ADMIN_PASSWORD = `demo-${Math.random().toString(36).slice(2)}A9!`;
const PHONE = { name: "Ananya Rao", usn: `4SU${String(Date.now()).slice(-7)}`, phone: `9${String(Date.now()).slice(-9)}`, branch: "CSE", pin: "482913" };

const testUrl = process.env.TEST_SUPABASE_URL!;
const testAnon = process.env.TEST_SUPABASE_ANON_KEY!;

function startServer(): Promise<ChildProcess> {
  // A production build pointed at the TEST project (NEXT_PUBLIC_* are inlined at build time).
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: testUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: testAnon,
    NEXT_PUBLIC_SITE_URL: SITE,
    NEXT_DIST_DIR: ".next-demo",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  console.log("Building the app against the test project…");
  execFileSync("npx", ["next", "build"], { env, stdio: "ignore" });
  const server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], { env, stdio: "ignore" });
  return new Promise((ok, fail) => {
    const until = Date.now() + 60_000;
    const poll = async () => {
      try {
        if ((await fetch(`${SITE}/screen`)).ok) return ok(server);
      } catch {}
      if (Date.now() > until) return fail(new Error("server didn't start"));
      setTimeout(poll, 500);
    };
    void poll();
  });
}

async function makeDemoAdmin() {
  const { data: list } = await service.auth.admin.listUsers({ perPage: 200 });
  for (const u of list?.users ?? []) if (u.email === ADMIN_EMAIL) await service.auth.admin.deleteUser(u.id);
  const { data, error } = await service.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true });
  if (error) throw error;
  await service.from("admins").insert({ user_id: data.user!.id });
}

/** A short video of chair 1's QR code, played by Chromium's fake camera so the phone's real scanner reads it. */
async function qrCameraFile(): Promise<string> {
  const { data } = await service.from("chairs").select("id, secret").eq("number", 1).is("deleted_at", null).single();
  const png = join(WORK, "chair1.png");
  await QRCode.toFile(png, chairUrl(SITE, data!.id, data!.secret), { width: 420, margin: 2 });
  const y4m = join(WORK, "chair1.y4m");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-i", png, "-vf", "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white", "-t", "4", "-r", "15", "-pix_fmt", "yuv420p", y4m]);
  return y4m;
}

const captionHtml = `<!doctype html><html><head><style>
  html,body{margin:0;height:100%;background:#07070C;color:#F2F4FF;font-family:-apple-system,system-ui,sans-serif}
  .wrap{padding:28px 26px;display:flex;flex-direction:column;height:100%;box-sizing:border-box}
  .kicker{color:#FFD54A;letter-spacing:.3em;font-weight:800;font-size:15px}
  h1{font-size:30px;margin:6px 0 4px;letter-spacing:.04em}
  .sub{color:#8A90B2;font-size:15px;line-height:1.5}
  .labels{margin:22px 0 14px;display:grid;gap:8px;font-size:15px}
  .labels b{color:#22E4FF}
  ol{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px;font-size:16px;line-height:1.35;overflow:hidden;flex:1}
  li{color:#8A90B2} li:last-child{color:#F2F4FF;font-weight:700;border-left:3px solid #FFB020;padding-left:10px}
</style></head><body><div class="wrap">
  <div class="kicker">TECHVIDYA</div><h1>AI Musical Chair</h1>
  <div class="sub">Automated demo · 30 players (29 bots + 1 phone) · chairs 25 → 15 → 8 → 3</div>
  <div class="labels"><div><b>Top left</b> · admin console</div><div><b>Bottom left</b> · projector</div><div><b>Right</b> · player phone (${PHONE.name})</div></div>
  <ol id="log"></ol></div></body></html>`;

async function caption(page: Page, line: string) {
  console.log("  " + line);
  await page.evaluate((l) => {
    const ol = document.getElementById("log")!;
    const li = document.createElement("li");
    li.textContent = l;
    ol.appendChild(li);
    while (ol.children.length > 16) ol.removeChild(ol.firstChild!);
  }, line);
}

async function focusAlways(page: Page) {
  // Every recorded page behaves as focused and visible (otherwise the anti-cheat guard would flag the phone).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
}

async function phaseNow(): Promise<{ status: string; phase: string | null; revealed: boolean }> {
  const { data } = await service.from("public_state").select("data").single();
  const s = data!.data as { game: { status: string }; spin: { phase: string; revealed?: boolean } | null };
  return { status: s.game.status, phase: s.spin?.phase ?? null, revealed: Boolean(s.spin?.revealed) };
}

async function waitFor(pred: (s: Awaited<ReturnType<typeof phaseNow>>) => boolean, ms = 12_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pred(await phaseNow())) return true;
    await sleep(250);
  }
  return false;
}

/** Admin steps through the real console: buttons and the documented keyboard shortcuts. */
function adminViaUi(page: Page) {
  const done: Record<AdminAction, (s: Awaited<ReturnType<typeof phaseNow>>) => boolean> = {
    start_round: (s) => s.status === "in_round" && s.phase === "music",
    open_scan_window: (s) => s.phase === "scan_open",
    close_scan_window: (s) => s.phase === "judging",
    reveal_results: (s) => s.revealed,
    next_spin: (s) => s.phase === "music",
    end_round: (s) => s.status === "round_complete" || s.status === "finished",
  };
  return async (action: AdminAction, admin: Actor) => {
    await page.bringToFront();
    if (action === "start_round") {
      await page.getByRole("button", { name: /^Start round \d+$/ }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Start round" }).click();
    } else if (action === "end_round") {
      await page.locator("body").click({ position: { x: 5, y: 700 } });
      await page.keyboard.press("e");
      await page.getByRole("dialog").getByRole("button", { name: "End round" }).click();
    } else {
      const key = { open_scan_window: " ", close_scan_window: "j", reveal_results: "r", next_spin: "n" }[action];
      await page.locator("body").click({ position: { x: 5, y: 700 } });
      await page.keyboard.press(key === " " ? "Space" : key);
    }
    if (!(await waitFor(done[action]))) {
      // The UI didn't take it (e.g. a button still busy): do it as the admin bot so the game continues.
      console.warn(`  (UI ${action} didn't register; using the RPC)`);
      await rpcOk(admin.client, action);
    }
  };
}

/** The phone: answers its question on screen a couple of seconds after the real scanner seats it. */
function phonePlayer(page: Page, stop: { done: boolean }) {
  return (async () => {
    while (!stop.done) {
      try {
        const back = page.locator("button", { hasText: "Back to the question" });
        if (await back.isVisible().catch(() => false)) {
          console.warn("  (phone: anti-cheat overlay shown; tapping Back to the question)");
          await back.click();
        }
        // A question is on screen while its options (or the one-word box) are enabled; Submit unlocks after a choice.
        const option = page.locator("[role=radiogroup] button:not([disabled])", { hasText: /right$/ });
        const box = page.locator("#answer:not([disabled])");
        const mcq = (await option.count()) > 0;
        if (mcq || (await box.count()) > 0) {
          await sleep(2200);
          if (mcq) await option.first().click({ timeout: 3000 });
          else await box.fill("right", { timeout: 3000 });
          await sleep(500);
          await page.locator("button", { hasText: "Submit answer" }).click({ timeout: 3000 });
          await sleep(3000);
        }
      } catch (e) {
        // Never let a missed click stop the recording: the round timer will count it as no answer.
        const text = await page.locator("body").innerText().catch(() => "");
        console.warn("  (phone: " + (e instanceof Error ? e.message.split("\n")[0] : String(e)) + " | screen: " + text.replace(/\s+/g, " ").slice(0, 160) + ")");
        await sleep(1500);
      }
      await sleep(400);
    }
  })();
}

async function main() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const server = await startServer();
  const contexts: { name: string; ctx: BrowserContext; page: Page; t: number }[] = [];
  try {
    console.log("Setting up the test game: questions, 29 bots, chairs…");
    const { admin } = await setupWorld(BOTS);
    await makeDemoAdmin();
    await rpcOk(admin.client, "create_chairs", { p_count: SCHEDULE[0] });
    const y4m = await qrCameraFile();

    const browser = await chromium.launch({
      channel: "chromium",
      args: ["--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${y4m}`, "--use-fake-ui-for-media-stream", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--use-angle=metal"],
    });
    const open = async (name: string, width: number, height: number, url: string, extra: Parameters<typeof browser.newContext>[0] = {}) => {
      const ctx = await browser.newContext({ viewport: { width, height }, recordVideo: { dir: join(WORK, name), size: { width, height } }, ...extra });
      const page = await ctx.newPage();
      contexts.push({ name, ctx, page, t: Date.now() });
      await focusAlways(page);
      // Headless Chrome resizes on fullscreen, which the anti-cheat guard (rightly) reads as leaving the game.
      if (name === "phone") {
        await page.addInitScript(() => {
          Element.prototype.requestFullscreen = () => Promise.resolve();
        });
      }
      await page.goto(url);
      return page;
    };

    const cap = await (async () => {
      const ctx = await browser.newContext({ viewport: { width: 461, height: 1080 }, recordVideo: { dir: join(WORK, "caption"), size: { width: 461, height: 1080 } } });
      const page = await ctx.newPage();
      contexts.push({ name: "caption", ctx, page, t: Date.now() });
      await page.setContent(captionHtml);
      return page;
    })();
    const adminPage = await open("admin", 1280, 720, `${SITE}/admin/login`);
    await open("screen", 1280, 720, `${SITE}/screen`);
    const phone = await open("phone", 390, 844, `${SITE}/play`, {
      // (fullscreen is stubbed for the phone above: headless Chrome's resize looks like leaving the game to the guard)
      isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["camera"], userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36" });

    await caption(cap, "Admin logs in");
    await adminPage.getByLabel("Email").fill(ADMIN_EMAIL);
    await adminPage.getByLabel("Password").fill(ADMIN_PASSWORD);
    await adminPage.getByRole("button", { name: /log in|sign in/i }).click();
    await adminPage.waitForURL(`${SITE}/admin`);

    await caption(cap, `${PHONE.name} registers on her phone`);
    await phone.getByLabel("Name").pressSequentially(PHONE.name, { delay: 40 });
    await phone.getByLabel("USN").pressSequentially(PHONE.usn, { delay: 40 });
    await phone.getByLabel("Phone").pressSequentially(PHONE.phone, { delay: 30 });
    await phone.getByLabel("Branch").fill(PHONE.branch);
    await phone.getByLabel("Create a 6-digit PIN").pressSequentially(PHONE.pin, { delay: 60 });
    await phone.getByRole("button", { name: "Join the game" }).click();
    await phone.getByText(/You're in/i).first().waitFor({ timeout: 20_000 });
    const { data: me } = await service.from("players").select("id").eq("usn", PHONE.usn).single();
    await caption(cap, "29 bots have registered too · 30 players in the lobby");
    await sleep(4000);

    const stop = { done: false };
    const phoneLoop = phonePlayer(phone, stop);
    const report = await playGame(admin, {
      bots: BOTS,
      schedule: SCHEDULE,
      correctRate: 0.7,
      noAnswerRate: 0.05,
      randomChairOps: false,
      pace: { musicMs: 4500, claimSpreadMs: 3500, answerMs: [2500, 7500], beatMs: 2600, roundGapMs: 7500 },
      seed: 2026,
      log: (l) => void caption(cap, l),
      admin: adminViaUi(adminPage),
      external: { playerIds: [me!.id], reservedChair: 1 },
    });
    stop.done = true;
    await phoneLoop;
    await caption(cap, `Game over · ${report.checks} rule checks passed`);
    await sleep(12_000);

    for (const c of contexts) await c.ctx.close();
    await browser.close();

    // Join the four recordings, aligned to the last one that started.
    const start = Math.max(...contexts.map((c) => c.t));
    const input = async (name: string) => {
      const c = contexts.find((x) => x.name === name)!;
      return { path: (await c.page.video()!.path()) as string, offset: ((start - c.t) / 1000).toFixed(2) };
    };
    const [a, s, p, k] = [await input("admin"), await input("screen"), await input("phone"), await input("caption")];
    const out = join(OUT, "ai-musical-chair-demo.mp4");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-ss", a.offset, "-i", a.path, "-ss", s.offset, "-i", s.path, "-ss", p.offset, "-i", p.path, "-ss", k.offset, "-i", k.path,
      "-filter_complex",
      "[0:v]scale=960:540,setsar=1[a];[1:v]scale=960:540,setsar=1[s];[2:v]scale=499:1080,setsar=1[p];[3:v]scale=461:1080,setsar=1[k];" +
        "[a][s]vstack[left];[left][p][k]hstack=inputs=3,fps=30,format=yuv420p[v]",
      "-map", "[v]", "-shortest", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-movflags", "+faststart", out,
    ]);
    console.log(`\nVideo: ${out}\n${report.checks} rule checks passed · winners: ${report.winners.map((w) => `#${w.rank} ${w.name}`).join(", ")}`);
  } finally {
    server.kill();
    await service.from("games").update({ status: "lobby", current_round_id: null }).eq("id", 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
