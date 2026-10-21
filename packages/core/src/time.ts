import type { TimerState } from "./types.js";

/**
 * NTP-style offset from one time:sync round trip: serverNow ≈ clientNow + offset.
 * Clients keep the sample with the smallest round trip.
 */
export function clockSample(sentAt: number, serverNow: number, receivedAt: number) {
  const rtt = receivedAt - sentAt;
  return { offset: serverNow - (sentAt + rtt / 2), rtt };
}

/** Remaining ms of a server timer given the client's corrected "server now". */
export function remainingMs(timer: TimerState, serverNow: number): number {
  if (timer.endsAt !== null) return Math.max(0, timer.endsAt - serverNow);
  if (timer.pausedRemainingMs !== null) return timer.pausedRemainingMs;
  return 0;
}
