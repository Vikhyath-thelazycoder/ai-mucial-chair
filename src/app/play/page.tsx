import type { Metadata } from "next";
import { PlayerApp } from "@/components/player/PlayerApp";

export const metadata: Metadata = {
  title: "Play · AI Musical Chair",
  robots: { index: false, follow: false },
};

export default function PlayPage() {
  return <PlayerApp />;
}
