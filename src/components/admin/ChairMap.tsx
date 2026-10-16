"use client";

import Link from "next/link";
import { useState } from "react";
import type { ChairTile, TileState } from "@/lib/admin/model";
import { friendlyError } from "@/lib/errors";
import { adminRpc } from "@/hooks/useAdminData";
import { Modal } from "./Modal";

const styles: Record<TileState, { border: string; badge: string; label: string }> = {
  free: { border: "border-line", badge: "bg-line text-muted", label: "FREE" },
  answering: { border: "border-amber shadow-[0_0_24px_rgb(255_176_32/0.15)]", badge: "bg-amber text-bg", label: "ANSWERING" },
  correct: { border: "border-lime shadow-[0_0_24px_rgb(182_255_59/0.15)]", badge: "bg-lime text-bg", label: "✓ CORRECT" },
  wrong: { border: "border-red shadow-[0_0_24px_rgb(255_59_92/0.18)]", badge: "bg-red text-bg", label: "✕ WRONG" },
  locked: { border: "border-lime/60", badge: "bg-lime/80 text-bg", label: "✓ LOCKED" },
};

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

type Pending = { kind: "correct" | "wrong" | "free"; tile: ChairTile } | null;

/** Live chair map (FEATURES F8, T-4.3): who is sitting where, the moment they scan. */
export function ChairMap({ tiles, canOverride }: { tiles: ChairTile[]; canOverride: boolean }) {
  const [pending, setPending] = useState<Pending>(null);

  if (tiles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
        No active chairs. Add chairs on <Link className="text-cyan underline" href="/admin/chairs">Chairs &amp; QR</Link>.
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Chairs">
        {tiles.map((t) => {
          const s = styles[t.state];
          return (
            <li key={t.chairId} className={`flex min-h-44 flex-col rounded-2xl border bg-surface p-3 ${s.border}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-2xl font-extrabold">{String(t.number).padStart(2, "0")}</span>
                <span className="flex items-center gap-1">
                  {t.alert && (
                    <span title="Left the game screen" className="rounded-full bg-red/20 px-2 py-0.5 text-[10px] font-bold text-red">
                      ⚠ LEFT
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] ${s.badge}`}>{s.label}</span>
                </span>
              </div>
              {t.player ? (
                <>
                  <p className="mt-2 truncate font-bold" title={t.player.name}>
                    {t.player.name}
                  </p>
                  <p className="font-mono text-xs text-muted">{t.player.usn}</p>
                  <p className="font-mono text-xs text-muted">{t.player.phone}</p>
                  {t.question && (
                    <p className="mt-2 line-clamp-2 text-xs text-text/70" title={t.question}>
                      {t.question}
                    </p>
                  )}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2 text-xs">
                    <span className="min-w-0 truncate text-text/80" title={t.answerLabel ?? ""}>
                      {t.answerLabel ?? `scanned ${time(t.scannedAt)}`}
                      {t.state === "wrong" && t.correctAnswer && <span className="text-muted"> (ans: {t.correctAnswer})</span>}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">{t.timeMs !== null ? `${(t.timeMs / 1000).toFixed(2)} s` : ""}</span>
                  </div>
                  {canOverride && t.attemptId && t.state !== "answering" && (
                    <div className="mt-2 flex gap-1 text-[11px]">
                      {t.state === "wrong" && (
                        <button type="button" className="rounded-md border border-line px-2 py-1 hover:border-lime" onClick={() => setPending({ kind: "correct", tile: t })}>
                          Mark correct
                        </button>
                      )}
                      {(t.state === "correct" || t.state === "locked") && (
                        <button type="button" className="rounded-md border border-line px-2 py-1 hover:border-red" onClick={() => setPending({ kind: "free", tile: t })}>
                          Free chair
                        </button>
                      )}
                    </div>
                  )}
                  {t.overridden && <p className="mt-1 text-[10px] text-amber">changed by host</p>}
                </>
              ) : (
                <p className="mt-auto text-sm text-muted">Waiting for a scan</p>
              )}
            </li>
          );
        })}
      </ul>

      {pending && (
        <Modal
          title={pending.kind === "free" ? `Free chair ${pending.tile.number}?` : `Mark chair ${pending.tile.number} correct?`}
          description={`${pending.tile.player?.name} (${pending.tile.player?.usn}). This is logged with your reason.`}
          input={{ label: "Reason", placeholder: "e.g. answer was right, typo" }}
          confirmLabel={pending.kind === "free" ? "Free chair" : "Mark correct"}
          danger={pending.kind === "free"}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            const err =
              pending.kind === "free"
                ? await adminRpc("free_chair", { p_chair_id: pending.tile.chairId, p_reason: reason })
                : await adminRpc("override_attempt", { p_attempt_id: pending.tile.attemptId, p_correct: true, p_reason: reason });
            return err ? friendlyError(err) : null;
          }}
        />
      )}
    </>
  );
}
