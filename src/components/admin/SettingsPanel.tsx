"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { adminRpc, useAdminData } from "@/hooks/useAdminData";
import { friendlyError } from "@/lib/errors";
import { Modal } from "./Modal";
import { SpotifyCheck } from "./music/SpotifyCheck";

type Form = { name: string; timer: number; finalCount: number; registrationOpen: boolean; autoOpen: boolean };

/** Game settings, plus "Restart this game" and "New game" for the next team (F17, D-014). */
export function SettingsPanel() {
  const { data, loading } = useAdminData();
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<null | "reset" | "new">(null);

  useEffect(() => {
    if (data.game && !form) {
      setForm({
        name: data.game.name,
        timer: data.game.timer_seconds,
        finalCount: data.game.final_chair_count,
        registrationOpen: data.game.registration_open,
        autoOpen: data.game.auto_open_on_pause,
      });
    }
  }, [data.game, form]);

  if (loading || !form) return <p className="text-muted motion-safe:animate-pulse">Loading settings…</p>;

  const save = async () => {
    const err = await adminRpc("update_game_settings", {
      p_name: form.name.trim(),
      p_registration_open: form.registrationOpen,
      p_final_chair_count: form.finalCount,
      p_timer_seconds: form.timer,
      p_auto_open_on_pause: form.autoOpen,
    });
    setMessage(err ? { ok: false, text: friendlyError(err) } : { ok: true, text: "Settings saved." });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">Settings · game #{data.sessionNumber}</h1>
      {message && <p role="status" className={`rounded-xl p-3 text-sm ${message.ok ? "bg-lime/10 text-lime" : "bg-red/10 text-red"}`}>{message.text}</p>}

      <Panel>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Game name (shown on the projector)
            <input value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Default answer timer (seconds)
            <input type="number" min={5} max={300} value={form.timer} onChange={(e) => setForm({ ...form, timer: Number(e.target.value) })} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Final round when chairs are at or below
            <input type="number" min={1} max={100} value={form.finalCount} onChange={(e) => setForm({ ...form, finalCount: Number(e.target.value) })} className="min-h-11 rounded-xl border border-line bg-bg px-3" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.registrationOpen} onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })} />
            Registration open
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.autoOpen} onChange={(e) => setForm({ ...form, autoOpen: e.target.checked })} />
            Pausing the music opens the scan window
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Save settings</Button>
          </div>
        </form>
      </Panel>

      <div id="spotify" className="scroll-mt-20">
        <SpotifyCheck />
      </div>

      <Panel className="border-red/40">
        <h2 className="font-bold text-red">Between teams</h2>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">New game for the next team</p>
              <p className="text-sm text-muted">Stops anything running, saves this game&apos;s results, and opens a fresh lobby. Chair QR codes stay the same.</p>
            </div>
            <Button variant="danger" onClick={() => setDialog("new")}>
              New game
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Restart this game</p>
              <p className="text-sm text-muted">Same registered players, back to the lobby. Clears this game&apos;s rounds and answers.</p>
            </div>
            <Button variant="ghost" onClick={() => setDialog("reset")}>
              Restart
            </Button>
          </div>
        </div>
      </Panel>

      {dialog === "new" && (
        <Modal
          title="Start a new game?"
          description="The current team's phones will need to register again to play. Type NEW GAME to confirm."
          input={{ label: "Type NEW GAME", mustEqual: "NEW GAME" }}
          confirmLabel="Start new game"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (value) => {
            const err = await adminRpc("start_new_game", { p_confirm: value });
            if (err) return friendlyError(err);
            setMessage({ ok: true, text: "New game started. The lobby is open." });
          }}
        />
      )}
      {dialog === "reset" && (
        <Modal
          title="Restart this game?"
          description="Clears every round and answer of this game. Type RESET to confirm."
          input={{ label: "Type RESET", mustEqual: "RESET" }}
          confirmLabel="Restart"
          danger
          onClose={() => setDialog(null)}
          onConfirm={async (value) => {
            const err = await adminRpc("reset_game", { p_confirm: value });
            if (err) return friendlyError(err);
            setMessage({ ok: true, text: "Game restarted. Everyone is back in the lobby." });
          }}
        />
      )}
    </div>
  );
}
