/** Milliseconds the server clock is ahead of this device. */
export function clockOffset(serverNowIso: string, localNowMs: number): number {
  return Date.parse(serverNowIso) - localNowMs;
}

/** Whole seconds left until a server-time deadline (rounded up, never negative). */
export function secondsLeft(deadlineIso: string, localNowMs: number, offsetMs: number): number {
  const remaining = Date.parse(deadlineIso) - (localNowMs + offsetMs);
  return Math.max(0, Math.ceil(remaining / 1000));
}
