// P4 admin-only server paths: remove a registration, reset a PIN, and the admin membership check.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/admin/session";
import { loginPlayer, registerPlayer } from "@/lib/player/auth";
import { anon, currentPlayer, deleteCreatedUsers, makeAdmin, makePlayer, resetWorld, rpcErr, rpcOk, service, signedInUser, type Actor } from "./harness";

let admin: Actor;
let squatter: Actor & { usn: string };

async function playerId(userId: string) {
  const { data } = await service.from("players").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
  return data!.id as string;
}

beforeAll(async () => {
  await resetWorld();
  admin = await makeAdmin("p4-admin");
  squatter = await makePlayer("squatter");
});

afterAll(async () => {
  await resetWorld();
  await deleteCreatedUsers();
});

describe("admin check", () => {
  it("is true only for listed admins", async () => {
    expect(await isAdmin(admin.client)).toBe(true);
    expect(await isAdmin(squatter.client)).toBe(false);
    expect(await isAdmin(anon())).toBe(false);
  });
});

describe("remove_player", () => {
  it("only admins can remove a registration, and a reason is required", async () => {
    const id = await playerId(squatter.userId);
    expect(await rpcErr(squatter.client, "remove_player", { p_player_id: id, p_reason: "x" })).toBe("NOT_ADMIN");
    expect(await rpcErr(admin.client, "remove_player", { p_player_id: id, p_reason: "" })).toBe("VALIDATION");
  });

  it("removing a squatter frees the USN for the real student", async () => {
    const id = await playerId(squatter.userId);
    await rpcOk(admin.client, "remove_player", { p_player_id: id, p_reason: "used someone else's USN" });
    const real = await signedInUser("real");
    await rpcOk(real.client, "register_player", { p_name: "Real Student", p_usn: squatter.usn, p_phone: "9123400001", p_branch: "CSE" });
    const { data: audit } = await service.from("admin_audit").select("action").eq("target", id);
    expect(audit).toEqual([{ action: "remove_player" }]);
  });
});

describe("admin-reset-pin function", () => {
  const usn = `4SUR${String(Date.now()).slice(-5)}`;
  const phone = anon();
  let id: string;

  beforeAll(async () => {
    await registerPlayer(phone, { name: "Forgetful Player", usn, phone: `97${usn.slice(-5)}111`, branch: "ECE", pin: "111111" });
    const { data } = await phone.auth.getUser();
    id = await playerId(data.user!.id);
  });

  afterAll(async () => {
    const { data } = await phone.auth.getUser();
    if (data.user) await service.auth.admin.deleteUser(data.user.id);
  });

  it("rejects callers who aren't signed in or aren't admins", async () => {
    const asPlayer = await squatter.client.functions.invoke("admin-reset-pin", { body: { playerId: id, pin: "222222" } });
    expect(asPlayer.data).toBeNull();
    expect(asPlayer.error).not.toBeNull();
    const asAnon = await anon().functions.invoke("admin-reset-pin", { body: { playerId: id, pin: "222222" } });
    expect(asAnon.error).not.toBeNull();
    await expect(loginPlayer(anon(), { usn, pin: "222222" })).rejects.toThrow();
  });

  it("lets an admin set a new PIN that the player can log in with", async () => {
    const res = await admin.client.functions.invoke("admin-reset-pin", { body: { playerId: id, pin: "222222" } });
    expect(res.data).toEqual({ status: "updated" });
    await loginPlayer(anon(), { usn, pin: "222222" });
    await expect(loginPlayer(anon(), { usn, pin: "111111" })).rejects.toThrow();
  });

  it("validates the new PIN", async () => {
    const res = await admin.client.functions.invoke("admin-reset-pin", { body: { playerId: id, pin: "12" } });
    expect(res.error).not.toBeNull();
  });
});

describe("live chair map data (T-4.3)", () => {
  it("shows who scanned which chair, with name, USN and chair number, and blocks the chair", async () => {
    const { loadAdminData } = await import("@/hooks/useAdminData");
    const { buildRoster, chairTiles } = await import("@/lib/admin/model");
    const sitter = await makePlayer("sitter");
    const watcher = await makePlayer("watcher");
    await rpcOk(admin.client, "create_chairs", { p_count: 2 });
    const { data: chairs } = await service.from("chairs").select("id, number, secret").order("number");
    await rpcOk(admin.client, "start_round");
    await rpcOk(admin.client, "open_scan_window");
    await rpcOk(sitter.client, "claim_chair", { p_chair_id: chairs![0].id, p_secret: chairs![0].secret });

    const data = await loadAdminData(admin.client);
    const tiles = chairTiles(data.chairs, data.attempts, data.spin!.id, new Set());
    const me = await currentPlayer<{ name: string; usn: string }>(sitter.userId, "name, usn");
    expect(tiles[0]).toMatchObject({ number: chairs![0].number, state: "answering", blocked: true, player: { name: me.name, usn: me.usn } });
    expect(tiles[1]).toMatchObject({ state: "free", blocked: false });

    const roster = buildRoster(data.players, data.scannedThisGame, new Set());
    expect(roster.inPlay.map((p) => p.usn)).toContain(me.usn);
    expect(roster.registered.map((p) => p.usn)).toContain(watcher.usn);
    await rpcOk(admin.client, "close_scan_window");
  });

  it("a player's session can't load the admin data", async () => {
    const { loadAdminData } = await import("@/hooks/useAdminData");
    const p = await makePlayer("nosy");
    await expect(loadAdminData(p.client)).rejects.toThrow();
  });
});
