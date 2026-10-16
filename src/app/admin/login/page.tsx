import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const metadata: Metadata = { title: "Admin login · AI Musical Chair", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <AdminLogin denied={denied === "1"} />
    </main>
  );
}
