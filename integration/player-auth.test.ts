// The real player sign-up path (synthetic USN email + PIN) against aimc-test. Requires
// "Confirm email" to be OFF in the project's Auth settings.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MyStatus } from "@/lib/game/types";
import { fetchMyStatus, lastDetails, loginPlayer, registerPlayer, rejoinCurrentGame } from "@/lib/player/auth";
import { anon, deleteCreatedUsers, makeAdmin, resetWorld, rpcOk, service, type Actor } from "./harness";

const salt = String(Date.now()).slice(-5);
const details = { name: "Auth Tester", usn: `4SUA${salt}`, phone: `98${salt}123`, branch: "ISE", pin: "135790" };

let admin: Actor;
const phone = anon();

beforeAll(async () => {
  await resetWorld();
  admin = await makeAdmin("auth-admin");
});

afterAll(async () => {
  const { data } = await phone.auth.getUser();
  if (data.user) await service.auth.admin.deleteUser(data.user.id);
  await resetWorld();
  await deleteCreatedUsers();
});

describe("player sign-up and login", () => {
  it("registers a brand-new player with USN + PIN and joins the current game", async () => {
    await registerPlayer(phone, details);
    const me = await fetchMyStatus(phone);
    expect(me.registered).toBe(true);
    expect((me as Extract<MyStatus, { registered: true }>).player).toMatchObject({ usn: details.usn, status: "active" });
  });

  it("logs back in with USN + PIN after signing out", async () => {
    await phone.auth.signOut();
    await loginPlayer(phone, { usn: details.usn.toLowerCase(), pin: details.pin });
    expect((await fetchMyStatus(phone)).registered).toBe(true);
  });

  it("rejects a wrong PIN", async () => {
    const other = anon();
    await expect(loginPlayer(other, { usn: details.usn, pin: "000000" })).rejects.toThrow("Invalid login credentials");
  });

  it("a stranger can't take over an existing USN by registering with a different PIN", async () => {
    const other = anon();
    await expect(registerPlayer(other, { ...details, pin: "999999" })).rejects.toThrow("User already registered");
  });

  it("the sign-up function rejects malformed input and creates nothing", async () => {
    for (const body of [{ usn: "4SU<script>", pin: "123456" }, { usn: "4SU22CS001", pin: "12" }, { usn: 5, pin: null }]) {
      const { data, error } = await anon().functions.invoke("player-signup", { body });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    }
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email?.startsWith("4su22cs001@"))).toBe(false);
  });

  it("after a New game the player re-joins with prefilled details, no new account", async () => {
    await rpcOk(admin.client, "start_new_game", { p_confirm: "NEW GAME" });
    const before = await fetchMyStatus(phone);
    expect(before).toMatchObject({ registered: false, playedBefore: true });

    const prefill = await lastDetails(phone);
    expect(prefill).toEqual({ name: details.name, usn: details.usn, phone: details.phone, branch: details.branch });
    await rejoinCurrentGame(phone, prefill!);
    expect((await fetchMyStatus(phone)).registered).toBe(true);
  });
});
