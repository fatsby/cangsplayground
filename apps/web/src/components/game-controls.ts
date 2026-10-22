import type { C2SPayload, GameSessionView, GroupGameView } from "@cangsplayground/core";
export type Control = C2SPayload<"game:control">["cmd"];
export function supportsControl(cmd: Control, session: GameSessionView): boolean {
  return !session.unsupportedControls?.some((unsupported) => unsupported === cmd);
}
export function canControl(cmd: Control, session: GameSessionView, group?: GroupGameView): boolean {
  if (!supportsControl(cmd, session)) return false;
  if (cmd === "exit") return true;
  if (cmd === "prepare") return session.stage === "CONFIGURING";
  const groups = group ? [group] : session.groups;
  return groups.some(
    (g) =>
      g.phase !== "FINISHED" &&
      (
        {
          start: g.phase === "PREPARED",
          pause: g.phase === "RUNNING" || (g.phase === "VOTING" && g.timer.endsAt !== null),
          resume:
            g.phase === "PAUSED" || (g.phase === "VOTING" && g.timer.pausedRemainingMs !== null),
          skip: g.phase === "RUNNING" || g.phase === "PAUSED" || g.phase === "VOTING",
          extend: g.phase === "RUNNING" || g.phase === "PAUSED" || g.phase === "VOTING",
          endRound:
            g.phase !== "ROUND_END" &&
            g.phase !== "VOTING" &&
            (session.voteDurationMs == null || g.phase === "RUNNING" || g.phase === "PAUSED"),
          reveal: g.phase === "ROUND_END" && !g.revealed,
          nextRound: g.phase === "ROUND_END",
        } as Partial<Record<Control, boolean>>
      )[cmd] === true,
  );
}
export function mainControl(
  session: GameSessionView,
  group?: GroupGameView,
): { cmd: Control; label: string } {
  for (const [cmd, label] of [
    ["prepare", "Prepare game"],
    ["start", "Start round"],
    ["pause", "Pause"],
    ["resume", "Resume"],
    ["nextRound", "Next round"],
  ] as const)
    if (canControl(cmd, session, group)) return { cmd, label };
  return { cmd: "start", label: "Start round" };
}
