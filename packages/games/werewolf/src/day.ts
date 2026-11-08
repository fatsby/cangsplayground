import type { Context, Reducer } from "./context.js";
import { deadlineFor } from "./deadline.js";
import { livingIds, livingPlayer, rolesOf } from "./players.js";
import { targetPayload } from "./payloads.js";
import { checkWinner, resolveDayVote, tallyVotes } from "./rules.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import { VERDICT_MS } from "./types.js";

/**
 * Day actions.
 * - `ww:dayVote {targetId}`: a living player votes for another living player during VOTE; the vote
 *   can be changed until the timer ends, and the vote never closes early.
 */
export const dayActions: Record<string, Reducer> = {
  "ww:dayVote": (shared, ctx, payload) => {
    const parsed = targetPayload.safeParse(payload);
    if (shared.stage !== "VOTE" || ctx.actor.kind !== "player" || !parsed.success) return null;
    const voter = ctx.actor.playerId;
    if (
      !livingPlayer(shared, voter) ||
      voter === parsed.data.targetId ||
      !livingPlayer(shared, parsed.data.targetId)
    )
      return null;
    shared.dayVotes[voter] = parsed.data.targetId;
    return shared;
  },
};

/** Discussion is over: open the ballot box for `voteSeconds`. */
export function enterVote(shared: WerewolfShared, ctx: Pick<Context, "config" | "now">): void {
  shared.stage = "VOTE";
  shared.dayVotes = {};
  shared.deadline = deadlineFor("VOTE", shared.night, ctx.now + ctx.config.voteSeconds * 1000);
}

/**
 * The vote timer ended: banish the player who reached the threshold (if any), record the public
 * totals and run the win check into `pendingWinner`. The VERDICT stage then plays the reveal before
 * the next night begins or the game ends.
 */
export function resolveVote(shared: WerewolfShared, ctx: Pick<Context, "now">): void {
  const alive = livingIds(shared);
  const banished = resolveDayVote(shared.dayVotes, alive);
  shared.lastVote = { eliminatedId: banished, counts: tallyVotes(shared.dayVotes, alive) };
  if (banished !== null) shared.players[banished]!.alive = false;
  shared.pendingWinner = checkWinner(rolesOf(shared), livingIds(shared));
  shared.stage = "VERDICT";
  shared.deadline = deadlineFor("VERDICT", shared.night, ctx.now + VERDICT_MS);
}
