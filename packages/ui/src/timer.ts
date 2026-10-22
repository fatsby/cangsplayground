import { remainingMs, type TimerState } from "@cangsplayground/core";
export function timerDisplay(timer: TimerState, now: number) {
  const ms = remainingMs(timer, now);
  const seconds = Math.ceil(ms / 1000);
  const paused = timer.pausedRemainingMs !== null;
  const idle = timer.endsAt === null && !paused;
  return {
    ms,
    seconds,
    paused,
    idle,
    label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    progress: Math.min(1, ms / Math.max(1, timer.durationMs)),
    tone: paused || idle ? "muted" : seconds <= 5 ? "danger" : seconds <= 10 ? "warning" : "accent",
  } as const;
}
