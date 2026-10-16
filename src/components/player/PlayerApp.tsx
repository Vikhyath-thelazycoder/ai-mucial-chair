"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicState, type Connection } from "@/hooks/usePublicState";
import { useMyStatus } from "@/hooks/useMyStatus";
import { lastDetails } from "@/lib/player/auth";
import { playerView } from "@/lib/player/view";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { AuthScreen, RejoinScreen } from "./AuthScreen";
import { QuestionPanel } from "./QuestionPanel";
import { ScanPanel } from "./ScanPanel";
import { StatusPanel } from "./StatusPanel";

type Details = { name: string; usn: string; phone: string; branch: string };

function Header({ round, name, connection, onLogout }: { round?: number; name?: string; connection: Connection; onLogout?: () => void }) {
  return (
    <header className="flex w-full items-center justify-between gap-3">
      <p className="font-display text-sm font-extrabold tracking-[0.06em]">AI MUSICAL CHAIR</p>
      <div className="flex items-center gap-2 text-xs text-muted">
        {connection !== "live" && (
          <span role="status" className="rounded-full border border-amber/50 px-2 py-1 text-amber">
            {connection === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
        )}
        {round ? <span className="rounded-full border border-line px-2 py-1">Round {round}</span> : null}
        {name ? <span className="max-w-28 truncate">{name}</span> : null}
        {onLogout && (
          <button type="button" onClick={onLogout} className="min-h-11 rounded-lg px-2 text-muted underline-offset-4 hover:underline">
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

export function PlayerApp() {
  const supabase = getBrowserSupabase();
  const [session, setSession] = useState<"unknown" | "in" | "out">("unknown");
  const [prefill, setPrefill] = useState<Details | null>(null);
  const pub = usePublicState();
  const my = useMyStatus(pub.version, session === "in");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session ? "in" : "out"));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ? "in" : "out"));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const view = session === "in" ? playerView(my.me, pub.state) : null;

  useEffect(() => {
    if (view?.kind === "register" && view.rejoin && !prefill) void lastDetails(supabase).then(setPrefill);
  }, [view, prefill, supabase]);

  const refresh = useCallback(() => void my.refresh(), [my]);
  const logout = async () => {
    await supabase.auth.signOut();
    setPrefill(null);
  };

  const me = my.me?.registered ? my.me : null;

  let body: React.ReactNode;
  if (session === "unknown" || (session === "in" && (!view || view.kind === "loading"))) {
    body = <p className="text-muted motion-safe:animate-pulse">Loading the game…</p>;
  } else if (session === "out") {
    body = <AuthScreen onDone={refresh} />;
  } else if (view!.kind === "register") {
    body = view!.rejoin ? (
      <RejoinScreen key={prefill?.usn ?? "none"} prefill={prefill} onDone={refresh} onLogout={logout} />
    ) : (
      // Signed in but never registered (e.g. registration failed midway): finish with a PIN-less form.
      <RejoinScreen prefill={null} onDone={refresh} onLogout={logout} />
    );
  } else if (view!.kind === "scan") {
    body = <ScanPanel onClaimed={refresh} />;
  } else if (view!.kind === "question" && me) {
    body = (
      <QuestionPanel
        key={view!.attempt.id}
        attempt={{ ...view!.attempt, question: view!.attempt.question! }}
        offsetMs={my.offsetMs}
        player={me.player}
        timerSeconds={pub.state?.round?.timerSeconds ?? 30}
        onSubmitted={refresh}
      />
    );
  } else {
    body = <StatusPanel view={view!} pub={pub.state} />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center gap-8 px-4 pt-5 pb-10">
      <Header
        round={pub.state?.round?.status === "active" ? pub.state.round.number : undefined}
        name={me?.player.name}
        connection={pub.connection}
        onLogout={session === "in" ? logout : undefined}
      />
      <div className="flex w-full flex-1 flex-col items-center justify-center">{body}</div>
    </main>
  );
}
