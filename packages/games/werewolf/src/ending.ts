import type { WerewolfShared } from "./WerewolfShared.js";

/** Enters ENDED: the hidden winner becomes public and nothing is scheduled any more. */
export function endGame(shared: WerewolfShared): void {
  shared.stage = "ENDED";
  shared.winner = shared.pendingWinner;
  shared.deadline = null;
}
