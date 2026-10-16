import { ChairRing } from "@/components/three/ChairRing";

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-4 pt-14 text-center">
      <p className="text-sm tracking-[0.2em] text-muted uppercase">Sai Vidya Institute of Technology · Tech Fest</p>
      <h1 className="mt-4 font-display text-4xl font-black tracking-[0.08em] sm:text-6xl">
        AI MUSICAL <span className="text-cyan [text-shadow:0_0_32px_rgb(34_228_255/0.6)]">CHAIR</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Grab a chair when the music stops. Scan it. Answer fast. Only right answers keep their seat.
      </p>
      <ChairRing count={10} lit={new Set([0, 2, 5, 7])} className="mt-6 h-[55vh] w-full max-w-5xl" />
    </main>
  );
}
