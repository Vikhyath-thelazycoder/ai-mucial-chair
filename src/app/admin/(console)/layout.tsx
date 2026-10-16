import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { MusicProvider } from "@/components/admin/music/MusicProvider";
import { isAdmin } from "@/lib/admin/session";
import { adminAccess } from "@/lib/admin/model";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin · AI Musical Chair", robots: { index: false, follow: false } };

// Server-side guard (SECURITY.md T8): nothing under /admin renders unless the signed-in user is in public.admins.
// The database enforces the same rule on every admin RPC, so this only keeps non-admins away from the UI.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const access = adminAccess({ signedIn: Boolean(data.user), admin: data.user ? await isAdmin(supabase) : false });
  if (access === "login") redirect("/admin/login");
  if (access === "denied") redirect("/admin/login?denied=1");

  return (
    <MusicProvider>
      <div className="min-h-dvh">
        <AdminNav email={data.user!.email ?? ""} />
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6">{children}</div>
      </div>
    </MusicProvider>
  );
}
