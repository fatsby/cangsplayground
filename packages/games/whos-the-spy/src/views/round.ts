import type { GroupGameView, GroupSummary } from "@cangsplayground/core";
export function roundLabel(group: GroupGameView, summary: GroupSummary): string {
  if (group.phase === "VOTING") return "Voting";
  if (group.phase === "ROUND_END") return "Vote result";
  if (group.phase === "FINISHED") return "Game over";
  const active = Math.max(
    1,
    summary.playerIds.filter((id) => !group.eliminated.includes(id)).length,
  );
  const rounds = Math.max(1, Math.round(group.turnCount / active));
  const round = Math.min(rounds, Math.floor(group.turnIndex / active) + 1);
  return `Round ${round} of ${rounds}`;
}
