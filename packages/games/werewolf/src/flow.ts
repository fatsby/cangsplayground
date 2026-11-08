import type { Context } from "./context.js";
import { deadlineFor } from "./deadline.js";
import { resolveDawn, startNight } from "./night.js";
import type { WerewolfShared } from "./WerewolfShared.js";

type FlowContext = Omit<Context, "actor">;

/** Enters ENDED: the hidden winner becomes public and nothing is scheduled any more. */
export function endGame(shared: WerewolfShared): void {
  shared.stage = "ENDED";
  shared.winner = shared.pendingWinner;
  shared.deadline = null;
}

/** Day starts: the discussion timer runs for `discussionSeconds`. */
export function enterDiscussion(shared: WerewolfShared, ctx: FlowContext): void {
  shared.stage = "DISCUSSION";
  shared.deadline = deadlineFor("DISCUSSION", shared.night, ctx.now + ctx.config.discussionSeconds * 1000);
}

/**
 * The current stage's deadline is due: move to the next stage. Returns the mutated state, or null
 * when the stage has no timed transition (SETUP, ENDED).
 */
export function advance(shared: WerewolfShared, ctx: FlowContext): WerewolfShared | null {
  switch (shared.stage) {
    case "REVEAL":
      startNight(shared, ctx);
      return shared;
    case "NIGHT":
      resolveDawn(shared, ctx);
      return shared;
    case "DAWN":
      if (shared.pendingWinner) endGame(shared);
      else enterDiscussion(shared, ctx);
      return shared;
    default:
      return null;
  }
}
