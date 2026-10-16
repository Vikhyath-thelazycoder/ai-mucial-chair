"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminAttempt, AdminChair, AdminPlayer } from "@/lib/admin/model";
import type { GameStatus, SpinPhase } from "@/lib/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type AdminGame = {
  name: string;
  status: GameStatus;
  registration_open: boolean;
  final_chair_count: number;
  timer_seconds: number;
  auto_open_on_pause: boolean;
  current_round_id: string | null;
  current_session_id: string;
};
export type AdminRound = {
  id: string;
  number: number;
  difficulty: number;
  timer_seconds: number;
  is_final: boolean;
  status: string;
};
export type AdminSpin = {
  id: string;
  number: number;
  phase: SpinPhase;
  scan_opened_at: string | null;
  revealed_at: string | null;
};
export type AdminAlert = {
  id: number;
  kind: "away_start" | "away_end";
  away_ms: number | null;
  acknowledged: boolean;
  created_at: string;
  attempt_id: string | null;
  players: { name: string; usn: string } | null;
  attempts: { chairs: { number: number } | null } | null;
};

export type AdminData = {
  game: AdminGame | null;
  sessionNumber: number | null;
  round: AdminRound | null;
  spin: AdminSpin | null;
  chairs: AdminChair[];
  attempts: AdminAttempt[];
  players: AdminPlayer[];
  scannedThisGame: Set<string>;
  alerts: AdminAlert[];
};

const empty: AdminData = {
  game: null,
  sessionNumber: null,
  round: null,
  spin: null,
  chairs: [],
  attempts: [],
  players: [],
  scannedThisGame: new Set(),
  alerts: [],
};

// games and rounds aren't published; every game RPC rewrites public_state in the same transaction, so it stands in for them.
const TABLES = [
  "public_state",
  "spins",
  "chairs",
  "attempts",
  "players",
  "alerts",
  "game_sessions",
] as const;

/** Reads everything the console shows. Exported so integration tests run the exact same queries. */
export async function loadAdminData(sb: SupabaseClient): Promise<AdminData> {
  const { data: game, error: gameError } = await sb
    .from("games")
    .select("*")
    .eq("id", 1)
    .single();
  if (gameError || !game) throw new Error(gameError?.message ?? "NOT_ADMIN");
  const sid = game.current_session_id as string;
  const [session, round, chairs, players, scanned, alerts] = await Promise.all([
    sb.from("game_sessions").select("number").eq("id", sid).single(),
    game.current_round_id
      ? sb.from("rounds").select("*").eq("id", game.current_round_id).single()
      : Promise.resolve({ data: null }),
    sb
      .from("chairs")
      .select("id, number, secret, is_active, deleted_at")
      .is("deleted_at", null)
      .order("number"),
    sb
      .from("players")
      .select(
        "id, name, usn, phone, branch, status, eliminated_in_round, final_rank, created_at",
      )
      .eq("session_id", sid)
      .order("created_at"),
    sb
      .from("attempts")
      .select("player_id, rounds!inner(session_id)")
      .eq("rounds.session_id", sid),
    sb
      .from("alerts")
      .select(
        "id, kind, away_ms, acknowledged, created_at, attempt_id, players!inner(name, usn, session_id), attempts(chairs(number))",
      )
      .eq("players.session_id", sid)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const roundRow = (round.data as AdminRound | null) ?? null;
  let spin: AdminSpin | null = null;
  let attempts: AdminAttempt[] = [];
  if (roundRow) {
    const [s, a] = await Promise.all([
      sb
        .from("spins")
        .select("id, number, phase, scan_opened_at, revealed_at")
        .eq("round_id", roundRow.id)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("attempts")
        .select(
          "id, spin_id, chair_id, player_id, result, time_ms, answer, scanned_at, overridden, players(name, usn, phone), questions(text, type, options, answer)",
        )
        .eq("round_id", roundRow.id),
    ]);
    spin = (s.data as AdminSpin | null) ?? null;
    attempts = (a.data as unknown as AdminAttempt[]) ?? [];
  }
  return {
    game: game as AdminGame,
    sessionNumber: (session.data as { number: number } | null)?.number ?? null,
    round: roundRow,
    spin,
    chairs: (chairs.data as AdminChair[]) ?? [],
    attempts,
    players: (players.data as AdminPlayer[]) ?? [],
    scannedThisGame: new Set(
      ((scanned.data as { player_id: string }[]) ?? []).map((r) => r.player_id),
    ),
    alerts: (alerts.data as unknown as AdminAlert[]) ?? [],
  };
}

/** Everything the console shows, re-read (debounced) whenever any game table changes over Realtime. */
export function useAdminData() {
  const [data, setData] = useState<AdminData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await loadAdminData(getBrowserSupabase()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "NOT_ADMIN");
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 150);
  }, [load]);

  useEffect(() => {
    void load();
    const sb = getBrowserSupabase();
    let channel = sb.channel("admin-console");
    for (const table of TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        reload,
      );
    }
    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      if (status === "SUBSCRIBED") reload();
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(channel);
    };
  }, [load, reload]);

  return { data, loading, error, live, reload };
}

/** Calls an admin RPC; returns the error code (or null). */
export async function adminRpc(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<string | null> {
  const { error } = await getBrowserSupabase().rpc(fn, args);
  return error ? error.message : null;
}
