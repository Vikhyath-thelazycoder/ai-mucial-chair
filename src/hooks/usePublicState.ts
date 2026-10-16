"use client";

import { useEffect, useState } from "react";
import type { PublicState } from "@/lib/game/types";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type Connection = "connecting" | "live" | "offline";

/**
 * The public game projection, kept live over Supabase Realtime. `version` bumps on every update so
 * dependants (my_status) can refetch. On (re)connect it refetches, so a dropped socket always resyncs.
 */
export function usePublicState() {
  const [state, setState] = useState<PublicState | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase.from("public_state").select("data").eq("id", 1).single();
      if (!cancelled && data) {
        setState(data.data as PublicState);
        setVersion((v) => v + 1);
      }
    };
    void load();

    const channel = supabase
      .channel("public_state")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "public_state" }, (payload) => {
        setState((payload.new as { data: PublicState }).data);
        setVersion((v) => v + 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          void load();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { state, connection, version };
}
