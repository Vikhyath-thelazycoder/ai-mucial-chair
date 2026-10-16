import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scan from the game · AI Musical Chair",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Reached only when someone scans a chair QR with a normal camera app. Deliberately does nothing:
// no claim, no lookup, and the secret in the URL is never read or echoed (SECURITY.md T2).
export default async function ChairLanding() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-sm tracking-[0.2em] text-muted uppercase">AI Musical Chair</p>
      <h1 className="max-w-md text-2xl font-bold">Scan this chair from the AI Musical Chair website.</h1>
      <p className="max-w-md text-muted">
        Your phone&apos;s camera app can&apos;t claim a chair. Open the game, log in, and use the scanner there when
        the music stops.
      </p>
      <Link href="/play" className="rounded-xl bg-cyan px-6 py-4 font-bold text-bg">
        Open the game
      </Link>
    </main>
  );
}
