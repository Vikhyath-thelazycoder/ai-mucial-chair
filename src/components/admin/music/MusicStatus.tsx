"use client";

import Link from "next/link";
import { useMusic } from "./MusicProvider";

/** Small Spotify indicator in the admin nav, so every page shows whether music is connected and playing. */
export function MusicStatus() {
  const m = useMusic();
  let dot = "bg-muted";
  let text = "Spotify off";
  if (m.status === "unconfigured") text = "Spotify not set up";
  else if (m.status === "connecting") {
    dot = "bg-amber";
    text = "Spotify connecting";
  } else if (m.status === "error") {
    dot = "bg-red";
    text = "Spotify problem";
  } else if (m.status === "ready") {
    dot = m.nowPlaying && !m.nowPlaying.paused ? "bg-lime" : "bg-cyan";
    text = m.nowPlaying ? `${m.nowPlaying.paused ? "Paused" : "Playing"}: ${m.nowPlaying.name}` : "Spotify ready";
  }
  return (
    <Link href="/admin/settings#spotify" className="flex min-h-11 max-w-56 items-center gap-2 rounded-lg px-2 text-sm text-muted hover:text-text" title={text}>
      <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="truncate">{text}</span>
    </Link>
  );
}
