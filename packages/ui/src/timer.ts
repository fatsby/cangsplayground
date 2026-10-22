import { remainingMs, type GroupGameView, type TimerState } from "@cangsplayground/core";
export function timerDisplay(timer: TimerState, now: number, idleFullDuration = false) {
  const paused = timer.pausedRemainingMs !== null;
  const idle = timer.endsAt === null && !paused;
  const ms = idle && idleFullDuration ? timer.durationMs : remainingMs(timer, now);
  const seconds = Math.ceil(ms / 1000);
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

export function showTurnTimer(group: Pick<GroupGameView, "phase" | "timer">): boolean {
  if (group.phase === "PREPARED") return false;
  const idle = group.timer.endsAt === null && group.timer.pausedRemainingMs === null;
  return !(idle && (group.phase === "ROUND_END" || group.phase === "FINISHED"));
}
export function allGroupsFinished(groups: Pick<GroupGameView, "phase">[]): boolean {
  return groups.length > 0 && groups.every((group) => group.phase === "FINISHED");
}
