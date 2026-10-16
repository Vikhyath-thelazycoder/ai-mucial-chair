"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { adminRpc, useAdminData } from "@/hooks/useAdminData";
import { buildRoster, type AdminPlayer } from "@/lib/admin/model";
import { friendlyError } from "@/lib/errors";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Modal } from "./Modal";

type Pending = null | { kind: "kick" | "restore" | "remove" | "pin"; player: AdminPlayer };

const SECTIONS = [
  { key: "inPlay", title: "In play", hint: "Sat down and scanned this game" },
  { key: "registered", title: "Registered, not scanned yet", hint: "Can still play round 1" },
  { key: "winners", title: "Winners", hint: "" },
  { key: "out", title: "Out", hint: "Eliminated, or never got a chair" },
  { key: "spectators", title: "Spectators", hint: "Registered after round 1" },
  { key: "removed", title: "Removed by host", hint: "" },
] as const;

/** Players (FEATURES F11, T-4.1, T-4.2, T-4.3): live roster with host actions, each needing a reason. */
export function PlayersPanel() {
  const { data, loading } = useAdminData();
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const locked = useMemo(() => new Set(data.attempts.filter((a) => a.result === "correct").map((a) => a.player_id)), [data.attempts]);
  const seat = useMemo(() => {
    const byPlayer = new Map<string, number>();
    const chairNumber = new Map(data.chairs.map((c) => [c.id, c.number]));
    for (const a of data.attempts) {
      if (a.spin_id === data.spin?.id || a.result === "correct") byPlayer.set(a.player_id, chairNumber.get(a.chair_id) ?? 0);
    }
    return byPlayer;
  }, [data.attempts, data.chairs, data.spin?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.players.filter((p) => p.name.toLowerCase().includes(q) || p.usn.toLowerCase().includes(q) || p.phone.includes(q)) : data.players;
  }, [data.players, query]);
  const roster = buildRoster(filtered, data.scannedThisGame, locked);

  if (loading) return <p className="text-muted motion-safe:animate-pulse">Loading players…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Players · game #{data.sessionNumber}</h1>
          <p className="text-sm text-muted">{data.players.length} registered. Updates live as people register and scan.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Search name, USN or phone
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-11 w-72 max-w-full rounded-xl border border-line bg-bg px-3" />
        </label>
      </div>
      {notice && <p role="status" className="rounded-xl bg-lime/10 p-3 text-sm text-lime">{notice}</p>}

      {SECTIONS.map(({ key, title, hint }) => {
        const list = roster[key];
        if (list.length === 0 && (key === "removed" || key === "spectators" || key === "winners")) return null;
        return (
          <Panel key={key}>
            <h2 className="font-bold">
              {title} <span className="text-muted">({list.length})</span>
            </h2>
            {hint && <p className="text-xs text-muted">{hint}</p>}
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nobody yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Name</th>
                      <th className="py-2 pr-3 font-medium">USN</th>
                      <th className="py-2 pr-3 font-medium">Phone</th>
                      <th className="py-2 pr-3 font-medium">Branch</th>
                      <th className="py-2 pr-3 font-medium">Chair</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className="border-t border-line">
                        <td className="py-2 pr-3">
                          {p.final_rank ? <span className="font-display text-gold">#{p.final_rank} </span> : null}
                          {p.name}
                          {locked.has(p.id) && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-bg">LOCKED</span>}
                          {p.eliminated_in_round ? <span className="ml-2 text-xs text-muted">out in round {p.eliminated_in_round}</span> : null}
                        </td>
                        <td className="py-2 pr-3 font-mono">{p.usn}</td>
                        <td className="py-2 pr-3 font-mono">{p.phone}</td>
                        <td className="py-2 pr-3">{p.branch}</td>
                        <td className="py-2 pr-3 font-mono">{seat.has(p.id) ? String(seat.get(p.id)).padStart(2, "0") : "—"}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-1 text-xs">
                            {p.status === "active" ? (
                              <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => setPending({ kind: "kick", player: p })}>
                                Kick
                              </button>
                            ) : (
                              <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => setPending({ kind: "restore", player: p })}>
                                Restore
                              </button>
                            )}
                            <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => setPending({ kind: "pin", player: p })}>
                              Reset PIN
                            </button>
                            <button type="button" className="rounded-md border border-line px-2 py-1 hover:border-red" onClick={() => setPending({ kind: "remove", player: p })}>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })}

      {pending && <PlayerAction pending={pending} onClose={() => setPending(null)} onDone={setNotice} />}
    </div>
  );
}

function PlayerAction({ pending, onClose, onDone }: { pending: NonNullable<Pending>; onClose: () => void; onDone: (m: string) => void }) {
  const p = pending.player;
  const who = `${p.name} (${p.usn})`;
  if (pending.kind === "pin") {
    return (
      <Modal
        title={`Reset PIN for ${p.name}`}
        description={`${p.usn} will log in with the new PIN. Tell it to them in person.`}
        input={{ label: "New 6-digit PIN", inputMode: "numeric", pattern: /^[0-9]{6}$/ }}
        confirmLabel="Set PIN"
        onClose={onClose}
        onConfirm={async (pin) => {
          const { data, error } = await getBrowserSupabase().functions.invoke<{ status: string }>("admin-reset-pin", { body: { playerId: p.id, pin } });
          if (error || data?.status !== "updated") return "Couldn't reset the PIN. Check you're still logged in as admin.";
          onDone(`New PIN set for ${who}.`);
        }}
      />
    );
  }
  const config = {
    kick: { title: `Kick ${p.name}?`, text: "They're out of this game and lose any chair they hold.", fn: "kick_player", label: "Kick", danger: true },
    restore: { title: `Restore ${p.name}?`, text: "They're back in play as an active player.", fn: "restore_player", label: "Restore", danger: false },
    remove: {
      title: `Remove ${p.name}'s registration?`,
      text: "Deletes this registration from the current game and frees the USN and phone (e.g. someone used another student's USN).",
      fn: "remove_player",
      label: "Remove",
      danger: true,
    },
  }[pending.kind];
  return (
    <Modal
      title={config.title}
      description={`${config.text} Your reason is logged.`}
      input={{ label: "Reason" }}
      confirmLabel={config.label}
      danger={config.danger}
      onClose={onClose}
      onConfirm={async (reason) => {
        const err = await adminRpc(config.fn, { p_player_id: p.id, p_reason: reason });
        if (err) return friendlyError(err);
        onDone(`${config.label}: ${who}.`);
      }}
    />
  );
}
