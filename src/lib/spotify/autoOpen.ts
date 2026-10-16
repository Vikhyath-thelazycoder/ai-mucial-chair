// "Pause opens scan window" (F14, T-603): decide whether a player state change is the host stopping the music.

export type PlaybackSnapshot = { paused: boolean; trackUri: string | null; position: number; duration: number };

/** A track that pauses this close to its end is finishing on its own, not being stopped. */
const TRACK_END_MS = 1500;

/**
 * True only for a real pause: playing → paused on the same track, mid-song. Track changes, the brief
 * paused state Spotify reports between tracks, and a track running out are not "music stopped".
 */
export function isMusicStop(prev: PlaybackSnapshot | null, next: PlaybackSnapshot | null): boolean {
  if (!prev || !next) return false;
  if (prev.paused || !next.paused) return false;
  if (!next.trackUri || next.trackUri !== prev.trackUri) return false;
  if (next.position <= 0) return false;
  if (next.duration > 0 && next.duration - next.position < TRACK_END_MS) return false;
  return true;
}

/**
 * Whether the stop should call open_scan_window. The phase check is a courtesy: the RPC itself refuses
 * anything but the `music` phase, so a pause in the lobby or mid-judging is harmless either way.
 */
export function shouldOpenScan({ stopped, autoOpenOnPause, phase }: { stopped: boolean; autoOpenOnPause: boolean; phase: string | null }): boolean {
  return stopped && autoOpenOnPause && phase === "music";
}
