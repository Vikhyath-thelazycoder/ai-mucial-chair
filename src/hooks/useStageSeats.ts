"use client";

import { useEffect, useRef, useState } from "react";
import type { StageSeat } from "@/lib/screen/view";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * The live seats (stage_seats, 0011) for the 3D stage on /screen and on the player status screen: updates
 * the moment someone scans (phones subscribe only while that screen shows, not during scan/question). Null until loaded, or if the table isn't deployed yet (callers fall
 * back to public_state). `version` (public_state) triggers a resync too, in case a realtime event was missed.
 */
export function useStageSeats(version: number): StageSeat[] | null {
  const [seats, setSeats] = useState<StageSeat[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useRef<() => void>(() => undefined);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    load.current = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const { data, error } = await supabase.from("stage_seats").select("number, occupant, state").order("number");
        if (!cancelled) setSeats(error ? null : (data as StageSeat[]));
      }, 80);
    };
    load.current();
    const channel = supabase
      .channel("stage_seats")
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_seats" }, () => load.current())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load.current();
      });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    load.current();
  }, [version]);

  return seats;
}
