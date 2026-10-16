"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { adminRpc, useAdminData, type AdminData } from "@/hooks/useAdminData";
import { buildRoster, chairTiles, controlState, shortcutAction, startBlocker } from "@/lib/admin/model";
import { allowedActions, nextDifficulty, type AdminAction } from "@/lib/engine";
import { siteUrl } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import { ChairMap } from "./ChairMap";
import { Modal } from "./Modal";
import { MusicBar } from "./music/MusicBar";
import { useMusic } from "./music/MusicProvider";
import { QrImage } from "./QrImage";

const PHASES = [
  { key: "music", label: "Music" },
  { key: "scan_open", label: "Scan window" },
  { key: "judging", label: "Judging" },
] as const;

function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [since]);
  return since ? Math.max(0, Math.floor((now - Date.parse(since)) / 1000)) : 0;
}

type Dialog = null | "start" | "end" | "force_end" | "join_qr";

export function GameConsole() {
  const { data, loading, error, live } = useAdminData();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const music = useMusic();

  const derived = useMemo(() => derive(data), [data]);
  const { allowed } = derived;

  const run = async (fn: string, args: Record<string, unknown> = {}) => {
    setBusy(true);
    setActionError(null);
    const err = await adminRpc(fn, args);
    setBusy(false);
    if (err) setActionError(friendlyError(err));
    return err;
  };

  const trigger = (action: AdminAction) => {
    if (action === "start_round") return setDialog("start");
    if (action === "end_round") return setDialog("end");
    // The manual button never depends on Spotify: open first, then stop the music if it's still playing.
    if (action === "open_scan_window") {
      void run(action).then((err) => (!err && music.nowPlaying && !music.nowPlaying.paused ? music.pause() : undefined));
      return;
    }
    void run(action);
  };

  // Keyboard shortcuts (DESIGN.md › Interaction); ignored while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || busy || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const action = shortcutAction(e.key, allowed);
      if (!action) return;
      e.preventDefault();
      trigger(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) return <p className="text-muted motion-safe:animate-pulse">Loading the console…</p>;
  if (error || !data.game) return <p role="alert" className="text-red">Couldn&apos;t load the game: {friendlyError(error)}</p>;

  const { game, round, spin } = data;

  return (
    <div className="flex flex-col gap-5">
      <ControlBar
        data={data}
        allowed={allowed}
        busy={busy}
        onAction={trigger}
        onForceEnd={() => setDialog("force_end")}
        startBlocked={derived.startBlocked}
        answered={derived.answered}
        claimed={derived.claimed}
      />
      {actionError && (
        <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
          {actionError}
        </p>
      )}
      {!live && <p className="rounded-xl border border-amber/40 p-2 text-sm text-amber">Reconnecting to live updates…</p>}
      <MusicBar autoOpen={game.auto_open_on_pause} />

      <div className="flex flex-wrap gap-5">
        <main className="min-w-0 flex-[999_1_640px]">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold">Live chair map</h1>
            <p className="text-sm text-muted">
              {round ? `Round ${round.number} · ${derived.lockedCount}/${derived.tiles.length} chairs locked` : "No round running"}
            </p>
          </div>
          <ChairMap tiles={derived.tiles} canOverride={game.status === "in_round" && spin?.phase !== "scan_open"} />
          <Standing data={data} derived={derived} />
        </main>

        <aside className="flex flex-[1_1_320px] flex-col gap-4">
          <Stats derived={derived} />
          {game.status === "finished" && <Winners data={data} derived={derived} />}
          <Alerts data={data} />
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Join the game</h2>
              <button type="button" onClick={() => setDialog("join_qr")} className="text-sm text-cyan">
                Show big
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <QrImage text={`${siteUrl()}/play`} size={96} label="QR code to join the game" className="rounded-lg" />
              <p className="text-sm break-all text-text/80">{siteUrl()}/play</p>
            </div>
          </Panel>
        </aside>
      </div>

      {dialog === "start" && <StartRoundDialog data={data} derived={derived} onClose={() => setDialog(null)} run={run} />}
      {dialog === "end" && (
        <Modal
          title={`End round ${round?.number}?`}
          description={`${derived.standingCount} player(s) without a chair will be eliminated.${round?.is_final || derived.tiles.length <= game.final_chair_count ? " This is the final round: the chair holders become the winners." : ""}`}
          confirmLabel="End round"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const err = await run("end_round");
            return err ? friendlyError(err) : null;
          }}
        />
      )}
      {dialog === "force_end" && (
        <Modal
          title="Force-end this round?"
          description="Not every chair has a correct answer. Everyone without a locked chair will be eliminated. Your reason is logged."
          input={{ label: "Reason" }}
          confirmLabel="Force end"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            const err = await run("end_round", { p_force: true, p_reason: reason });
            return err ? friendlyError(err) : null;
          }}
        />
      )}
      {dialog === "join_qr" && (
        <Modal title="Scan to join" confirmLabel="Done" onClose={() => setDialog(null)} onConfirm={() => null}>
          <div className="mt-4 flex flex-col items-center gap-3">
            <QrImage text={`${siteUrl()}/play`} size={320} label="QR code to join the game" className="rounded-xl" />
            <p className="font-mono text-sm">{siteUrl()}/play</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function derive(data: AdminData) {
  const spinId = data.spin?.id ?? null;
  const openAlerts = new Set(data.alerts.filter((a) => !a.acknowledged && a.attempt_id).map((a) => a.attempt_id!));
  const tiles = chairTiles(data.chairs, data.attempts, spinId, openAlerts);
  const correct = data.attempts.filter((a) => a.result === "correct");
  const lockedChairIds = new Set(correct.map((a) => a.chair_id));
  const lockedPlayerIds = new Set(correct.map((a) => a.player_id));
  const roster = buildRoster(data.players, data.scannedThisGame, lockedPlayerIds);
  const activePlayers = data.players.filter((p) => p.status === "active").length;
  const state = data.game
    ? controlState({ gameStatus: data.game.status, phase: data.spin?.phase ?? null, chairs: data.chairs, lockedChairIds, activePlayers })
    : null;
  const thisSpin = data.attempts.filter((a) => a.spin_id === spinId);
  return {
    tiles,
    roster,
    allowed: state ? allowedActions(state) : new Set<AdminAction>(),
    startBlocked: state ? startBlocker(state) : null,
    lockedCount: state?.lockedChairCount ?? 0,
    activePlayers,
    standingCount: activePlayers - lockedPlayerIds.size,
    claimed: thisSpin.length,
    answered: thisSpin.filter((a) => a.result !== "pending").length,
    wrongThisSpin: new Set(thisSpin.filter((a) => a.result === "wrong" || a.result === "timed_out").map((a) => a.player_id)),
    lockedPlayerIds,
  };
}
type Derived = ReturnType<typeof derive>;

function ControlBar({
  data,
  allowed,
  busy,
  onAction,
  onForceEnd,
  startBlocked,
  answered,
  claimed,
}: {
  data: AdminData;
  allowed: Set<AdminAction>;
  busy: boolean;
  onAction: (a: AdminAction) => void;
  onForceEnd: () => void;
  startBlocked: "NO_CHAIRS" | "NO_PLAYERS" | null;
  answered: number;
  claimed: number;
}) {
  const { game, round, spin } = data;
  const elapsed = useElapsed(spin?.phase === "scan_open" ? spin.scan_opened_at : null);
  const allAnswered = claimed > 0 && answered === claimed;
  const btn = (action: AdminAction, label: string, variant: "primary" | "attention" | "ghost" = "primary") =>
    allowed.has(action) ? (
      <Button key={action} variant={variant} disabled={busy} onClick={() => onAction(action)}>
        {label}
      </Button>
    ) : null;

  return (
    <Panel glass className="sticky top-[61px] z-20 flex flex-wrap items-center gap-3">
      <div className="mr-2">
        <p className="font-display text-sm tracking-[0.05em]">
          {round ? `ROUND ${round.number}` : game?.status === "finished" ? "GAME OVER" : "LOBBY"}
          {spin && round?.status === "active" ? <span className="text-muted"> · SPIN {spin.number}</span> : null}
        </p>
        <p className="text-xs text-muted">
          Game #{data.sessionNumber} {round?.is_final ? "· FINAL ROUND" : ""}
        </p>
      </div>
      {game?.status === "in_round" && (
        <ol className="flex flex-wrap gap-1.5" aria-label="Spin phase">
          {PHASES.map((p) => (
            <li
              key={p.key}
              aria-current={spin?.phase === p.key ? "step" : undefined}
              className={`rounded-full border px-3 py-1 text-xs ${
                spin?.phase === p.key ? (p.key === "scan_open" ? "border-amber bg-amber font-bold text-bg" : "border-cyan bg-cyan font-bold text-bg") : "border-line text-muted"
              }`}
            >
              {p.label}
            </li>
          ))}
        </ol>
      )}
      <div className="flex-1" />
      {spin?.phase === "scan_open" && (
        <p className="text-sm text-muted">
          <span className="font-mono text-2xl text-amber tabular-nums">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>{" "}
          · {answered}/{claimed} answered
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {btn("start_round", round && game?.status !== "lobby" ? `Start round ${round.number + 1}` : "Start round 1")}
        {startBlocked && (
          <span className="flex items-center gap-3">
            <Button disabled>{game?.status === "round_complete" && round ? `Start round ${round.number + 1}` : "Start round 1"}</Button>
            <span className="text-sm text-amber">
              {startBlocked === "NO_PLAYERS" ? (
                "Waiting for players to register. Show them the join QR."
              ) : (
                <>
                  Switch on at least one chair in <Link href="/admin/chairs" className="underline">Chairs &amp; QR</Link>.
                </>
              )}
            </span>
          </span>
        )}
        {btn("open_scan_window", "Music stopped · open scan  [Space]", "attention")}
        {btn("close_scan_window", allAnswered ? "Everyone answered · judge  [J]" : "Close scan & judge  [J]", allAnswered ? "attention" : "primary")}
        {btn("next_spin", "Next spin  [N]")}
        {btn("end_round", "End round  [E]", "attention")}
        {game?.status === "in_round" && spin?.phase !== "scan_open" && !allowed.has("end_round") && (
          <Button variant="ghost" disabled={busy} onClick={onForceEnd}>
            Force end…
          </Button>
        )}
      </div>
    </Panel>
  );
}

function StartRoundDialog({
  data,
  derived,
  onClose,
  run,
}: {
  data: AdminData;
  derived: Derived;
  onClose: () => void;
  run: (fn: string, args?: Record<string, unknown>) => Promise<string | null>;
}) {
  const game = data.game!;
  const nextNumber = data.game?.status === "lobby" ? 1 : (data.round?.number ?? 0) + 1;
  const chairs = data.chairs.filter((c) => c.is_active).length;
  const [difficulty, setDifficulty] = useState(nextDifficulty(nextNumber));
  const [timer, setTimer] = useState(game.timer_seconds);
  const [final, setFinal] = useState(chairs <= game.final_chair_count);

  return (
    <Modal
      title={`Start round ${nextNumber}`}
      description={
        <>
          {chairs} active chair(s) · {derived.activePlayers} player(s) still in.{" "}
          <Link href="/admin/chairs" className="text-cyan underline">
            Change chairs
          </Link>
        </>
      }
      confirmLabel="Start round"
      onClose={onClose}
      onConfirm={async () => {
        const err = await run("start_round", { p_difficulty: difficulty, p_timer_seconds: timer, p_final: final });
        return err ? friendlyError(err) : null;
      }}
    >
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Difficulty (1–5)
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-bg px-3">
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Answer timer (seconds)
          <input type="number" min={5} max={300} value={timer} onChange={(e) => setTimer(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
        </label>
        <label className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} />
          Final round (chair holders become the winners)
        </label>
      </div>
    </Modal>
  );
}

function Stats({ derived }: { derived: Derived }) {
  const r = derived.roster;
  const items = [
    { label: "Registered", value: r.registered.length + r.inPlay.length + r.out.length + r.winners.length + r.spectators.length, tone: "text-text" },
    { label: "In play (scanned)", value: r.inPlay.length, tone: "text-cyan" },
    { label: "Chairs locked", value: `${derived.lockedCount}/${derived.tiles.length}`, tone: "text-lime" },
    { label: "Answered this spin", value: `${derived.answered}/${derived.claimed}`, tone: "text-amber" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((s) => (
        <Panel key={s.label} className="p-3">
          <p className={`font-mono text-2xl tabular-nums ${s.tone}`}>{s.value}</p>
          <p className="text-xs text-muted">{s.label}</p>
        </Panel>
      ))}
    </div>
  );
}

function Standing({ data, derived }: { data: AdminData; derived: Derived }) {
  if (data.game?.status !== "in_round") return null;
  const standing = data.players.filter((p) => p.status === "active" && !derived.lockedPlayerIds.has(p.id));
  return (
    <Panel className="mt-4">
      <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Standing · play the next spin ({standing.length})</h2>
      {standing.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Everyone still in has a chair.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2 text-sm">
          {standing.map((p) => (
            <li key={p.id} className={`rounded-full border px-3 py-1 ${derived.wrongThisSpin.has(p.id) ? "border-red text-red" : "border-line"}`}>
              {p.name} <span className="font-mono text-xs text-muted">{p.usn}</span>
              {derived.wrongThisSpin.has(p.id) && <span className="sr-only"> (answered wrong this spin)</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Winners({ data, derived }: { data: AdminData; derived: Derived }) {
  return (
    <Panel className="border-gold/60">
      <h2 className="text-xs tracking-[0.08em] text-gold uppercase">Winners</h2>
      <ol className="mt-2 flex flex-col gap-1">
        {derived.roster.winners.map((w) => (
          <li key={w.id}>
            <span className="font-display text-gold">#{w.final_rank}</span> {w.name} <span className="font-mono text-xs text-muted">{w.usn}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">
        Next team? Start a <Link href="/admin/settings" className="text-cyan underline">New game</Link>. Chair QR codes stay the same.
      </p>
      <span className="sr-only">{data.sessionNumber}</span>
    </Panel>
  );
}

function Alerts({ data }: { data: AdminData }) {
  const open = data.alerts.filter((a) => !a.acknowledged);
  return (
    <Panel className={open.length ? "border-red/50" : ""}>
      <h2 className={`text-xs tracking-[0.08em] uppercase ${open.length ? "text-red" : "text-muted"}`}>Anti-cheat alerts · {open.length}</h2>
      {data.alerts.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No one has left the game screen.</p>
      ) : (
        <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto" aria-live="polite">
          {data.alerts.map((a) => (
            <li key={a.id} className={`flex items-start justify-between gap-2 rounded-xl p-2 text-sm ${a.acknowledged ? "opacity-50" : "bg-red/10"}`}>
              <div>
                <strong>{a.players?.name}</strong>
                {a.attempts?.chairs ? ` (chair ${a.attempts.chairs.number})` : ""}{" "}
                {a.kind === "away_start" ? "left the game screen" : `came back after ${((a.away_ms ?? 0) / 1000).toFixed(1)} s`}
                <p className="text-xs text-muted">{new Date(a.created_at).toLocaleTimeString()}</p>
              </div>
              {!a.acknowledged && (
                <button type="button" className="shrink-0 rounded-md border border-line px-2 py-1 text-xs" onClick={() => void adminRpc("acknowledge_alert", { p_alert_id: a.id })}>
                  Seen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
