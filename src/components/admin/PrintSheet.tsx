"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminData } from "@/hooks/useAdminData";
import { chairUrl } from "@/lib/qr";
import { isLocalSite, siteBase } from "./ChairManager";
import { QrImage } from "./QrImage";

/** A4 sheet, 6 chairs per page: big QR + huge chair number so chairs never get mixed up (FEATURES F7). */
export function PrintSheet() {
  const { data, loading } = useAdminData();
  const [onlyActive, setOnlyActive] = useState(false);
  const chairs = data.chairs.filter((c) => !onlyActive || c.is_active);

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-2xl font-bold">Print chair QR codes</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Only chairs in play
        </label>
        <Button onClick={() => window.print()}>Print</Button>
        {isLocalSite(siteBase()) && (
          <p className="w-full text-sm text-amber">Warning: these codes point to {siteBase()}. Print from the deployed site.</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-[6mm]">
        {chairs.map((c) => (
          <section
            key={c.id}
            className="flex break-inside-avoid flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white p-5 text-black print:h-[88mm] print:rounded-none print:border-gray-400"
          >
            <p className="text-xs font-bold tracking-[0.2em] uppercase">AI Musical Chair · scan only in the game</p>
            <QrImage text={chairUrl(siteBase(), c.id, c.secret)} size={220} label={`QR code for chair ${c.number}`} />
            <p className="font-display text-sm font-bold tracking-[0.3em]">CHAIR</p>
            <p className="font-display text-7xl leading-none font-black">{String(c.number).padStart(2, "0")}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
