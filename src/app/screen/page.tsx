import type { Metadata } from "next";
import { ScreenApp } from "@/components/screen/ScreenApp";

export const metadata: Metadata = { title: "Projector · AI Musical Chair", robots: { index: false, follow: false } };

export default function ScreenPage() {
  return <ScreenApp />;
}
