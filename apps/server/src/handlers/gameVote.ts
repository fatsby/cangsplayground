import { fail } from "../auth/errors.js";
import { hostLobby, type HandlerContext, type Register } from "./context.js";

/** Minigame vote: the host opens and clears it, players cast and change their choice. */
export function registerGameVote(ctx: HandlerContext, on: Register) {
  on("gameVote:start", ({ gameIds }) => hostLobby(ctx).startGameVote(gameIds), true);
  on("gameVote:clear", () => hostLobby(ctx).clearGameVote(), true);
  on("gameVote:cast", ({ gameId }) => {
    const a = ctx.current();
    if (!a || a.viewer.kind !== "player") fail("UNAUTHORIZED", "Join the lobby first.");
    a.lobby.castGameVote(a.viewer.playerId, gameId);
  });
}
