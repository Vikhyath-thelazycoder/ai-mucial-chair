"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin", label: "Game" },
  { href: "/admin/chairs", label: "Chairs & QR" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => {
    await getBrowserSupabase().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22E4FF" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M7 3v10M7 13h11M8 13v8M17 13v8M7 8h6" />
          </svg>
          <span className="font-display text-base font-extrabold tracking-[0.06em]">AI MUSICAL CHAIR</span>
          <span className="hidden border-l border-line pl-3 text-sm text-muted sm:inline">Admin</span>
        </div>
        <nav aria-label="Admin" className="flex flex-wrap gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 ${active ? "border border-line bg-surface text-text" : "text-muted hover:text-text"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden max-w-48 truncate md:inline">{email}</span>
          <button type="button" onClick={logout} className="min-h-11 rounded-lg px-3 hover:text-text">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
