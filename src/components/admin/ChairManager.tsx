"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { adminRpc, useAdminData } from "@/hooks/useAdminData";
import { siteUrl } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import { chairUrl } from "@/lib/qr";
import { Modal } from "./Modal";
import { QrImage } from "./QrImage";

export function siteBase() {
  return siteUrl();
}

export function isLocalSite(url: string) {
  try {
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(new URL(url).hostname);
  } catch {
    return true;
  }
}

type Pending = null | { kind: "delete" | "rotate"; id: string; number: number };

/** Chairs & QR (FEATURES F7): any number of chairs; QR codes are permanent across games (D-014). */
export function ChairManager() {
  const { data, loading } = useAdminData();
  const [add, setAdd] = useState(10);
  const [forRound, setForRound] = useState<number | "">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const chairs = data.chairs;
  const active = chairs.filter((c) => c.is_active);
  const scanning = data.spin?.phase === "scan_open" && data.round?.status === "active";

  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const err = await adminRpc(fn, args);
    setBusy(false);
    setMessage(err ? { ok: false, text: friendlyError(err) } : { ok: true, text: ok });
    return err;
  };

  const applyFirst = async (n: number) => {
    const sorted = [...chairs].sort((a, b) => a.number - b.number);
    const on = sorted.slice(0, n).map((c) => c.id);
    const off = sorted.slice(n).map((c) => c.id);
    if (on.length && (await run("set_chairs_active", { p_ids: on, p_active: true }, ""))) return;
    if (off.length && (await run("set_chairs_active", { p_ids: off, p_active: false }, ""))) return;
    setMessage({ ok: true, text: `Chairs 1–${n} are switched on; the rest are off.` });
  };

  if (loading) return <p className="text-muted motion-safe:animate-pulse">Loading chairs…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Chairs &amp; QR codes</h1>
          <p className="text-sm text-muted">
            {chairs.length} chair(s) · {active.length} switched on. Print once: the codes stay the same for every game.
          </p>
        </div>
        <Link href="/admin/chairs/print" target="_blank" className="rounded-xl bg-cyan px-4 py-3 text-sm font-bold text-bg">
          Print QR sheet ↗
        </Link>
      </div>

      {isLocalSite(siteBase()) && (
        <p className="rounded-xl border border-amber/50 p-3 text-sm text-amber">
          These QR codes point to <span className="font-mono">{siteBase()}</span>, which phones can&apos;t open. Print them from the
          deployed (Vercel) site so they point to the real address.
        </p>
      )}
      {scanning && <p className="rounded-xl border border-amber/50 p-3 text-sm text-amber">Players are scanning right now: chairs can&apos;t change until the scan window closes.</p>}
      {message && (
        <p role="status" className={`rounded-xl p-3 text-sm ${message.ok ? "bg-lime/10 text-lime" : "bg-red/10 text-red"}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="font-bold">Add chairs</h2>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("create_chairs", { p_count: add }, `Added ${add} chair(s).`);
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              How many
              <input type="number" min={1} max={100} value={add} onChange={(e) => setAdd(Number(e.target.value))} className="min-h-11 w-28 rounded-xl border border-line bg-bg px-3" />
            </label>
            <Button type="submit" disabled={busy || scanning || add < 1}>
              Add
            </Button>
          </form>
        </Panel>
        <Panel>
          <h2 className="font-bold">Chairs for the next round</h2>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (forRound) void applyFirst(forRound);
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Use chairs 1 to
              <input
                type="number"
                min={1}
                max={chairs.length}
                value={forRound}
                onChange={(e) => setForRound(e.target.value ? Number(e.target.value) : "")}
                className="min-h-11 w-28 rounded-xl border border-line bg-bg px-3"
              />
            </label>
            <Button type="submit" disabled={busy || scanning || !forRound}>
              Apply
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted">
            <strong>On</strong> = the chair is used in the game (players can scan it). <strong>Off</strong> = put aside, e.g. chairs removed between
            rounds. Switch chairs one by one below, or use this box. A chair someone has won this round can&apos;t be switched off until the round ends.
          </p>
        </Panel>
      </div>

      {chairs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">No chairs yet. Add some above.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
          {chairs.map((c) => (
            <li key={c.id} className={`flex flex-col items-center gap-2 rounded-2xl border bg-surface p-3 ${c.is_active ? "border-line" : "border-dashed border-line opacity-60"}`}>
              <span className="font-display text-3xl font-black">{String(c.number).padStart(2, "0")}</span>
              <QrImage text={chairUrl(siteBase(), c.id, c.secret)} size={110} label={`QR code for chair ${c.number}`} className="rounded" />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.is_active}
                  disabled={busy || scanning}
                  onChange={(e) => void run("set_chairs_active", { p_ids: [c.id], p_active: e.target.checked }, `Chair ${c.number} ${e.target.checked ? "on" : "off"}.`)}
                />
                {c.is_active ? "On" : "Off"}
              </label>
              <div className="flex gap-1 text-xs">
                <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => setPending({ kind: "rotate", id: c.id, number: c.number })}>
                  New QR
                </button>
                <button type="button" className="rounded-md border border-line px-2 py-1 hover:border-red" onClick={() => setPending({ kind: "delete", id: c.id, number: c.number })}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <Modal
          title={pending.kind === "delete" ? `Delete chair ${pending.number}?` : `New QR code for chair ${pending.number}?`}
          description={
            pending.kind === "delete"
              ? "It disappears from the game. Past results keep it for the record."
              : "The printed QR for this chair stops working. Print and stick the new one."
          }
          confirmLabel={pending.kind === "delete" ? "Delete chair" : "Make new QR"}
          danger
          onClose={() => setPending(null)}
          onConfirm={async () => {
            const err =
              pending.kind === "delete"
                ? await run("delete_chairs", { p_ids: [pending.id] }, `Chair ${pending.number} deleted.`)
                : await run("rotate_chair_secret", { p_chair_id: pending.id }, `Chair ${pending.number} has a new QR. Reprint it.`);
            return err ? friendlyError(err) : null;
          }}
        />
      )}
    </div>
  );
}
