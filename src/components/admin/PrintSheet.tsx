"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminData } from "@/hooks/useAdminData";
import { chairUrl } from "@/lib/qr";
import { isLocalSite, siteBase } from "./ChairManager";
import { QrImage } from "./QrImage";

/**
 * A4 print sheet: 2 chairs per page (FEATURES F7). Each half-page card has a large QR on the left and the
 * chair number, big and centred, on the right, so chairs never get mixed up. Dashed borders are cut lines.
 */
export function PrintSheet() {
  const { data, loading } = useAdminData();
  const [onlyOn, setOnlyOn] = useState(false);
  const chairs = data.chairs.filter((c) => !onlyOn || c.is_active);

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold">Print chair QR codes</h1>
        <p className="text-sm text-muted">
          {chairs.length} chair(s) · 2 per A4 page · {Math.ceil(chairs.length / 2)} page(s)
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOn} onChange={(e) => setOnlyOn(e.target.checked)} />
          Skip chairs that are switched off
        </label>
        <Button onClick={() => window.print()}>Print</Button>
        {isLocalSite(siteBase()) && <p className="w-full text-sm text-amber">These codes point to {siteBase()}. Print from the live site instead.</p>}
      </div>

      <div className="mx-auto flex max-w-[190mm] flex-col gap-6 print:max-w-none print:gap-0">
        {chairs.map((c, i) => (
          <section
            key={c.id}
            className={`grid h-[132mm] grid-cols-[100mm_1fr] items-center gap-[8mm] overflow-hidden rounded-xl border-2 border-dashed border-gray-400 bg-white px-[8mm] text-black print:rounded-none ${
              i % 2 === 0 ? "print:mb-[8mm]" : "print:break-after-page"
            }`}
            style={{ breakInside: "avoid" }}
          >
            <div className="flex flex-col items-center gap-[3mm]">
              <QrImage text={chairUrl(siteBase(), c.id, c.secret)} size={380} label={`QR code for chair ${c.number}`} className="h-[100mm] w-[100mm]" />
              <p className="text-center text-[9pt] font-semibold tracking-[0.12em] uppercase">Scan only from the AI Musical Chair website</p>
            </div>
            <div className="flex h-full flex-col items-center justify-center border-l-2 border-gray-300 text-center">
              <p className="font-display text-[16pt] font-bold tracking-[0.4em]">CHAIR</p>
              <p className="font-display text-[110pt] leading-none font-black tabular-nums">{String(c.number).padStart(2, "0")}</p>
              <p className="mt-[4mm] font-display text-[10pt] tracking-[0.2em] text-gray-600">AI MUSICAL CHAIR</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
