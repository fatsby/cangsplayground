import { fail } from "../auth/errors.js";
import { hostLobby, type HandlerContext, type Register } from "./context.js";
export function registerGame(ctx: HandlerContext, on: Register) {
  on("game:select", ({ gameId }) => hostLobby(ctx).selectGame(gameId), true);
  on("game:configure", ({ config }) => hostLobby(ctx).configure(config), true);
  on("game:control", ({ cmd, groupId }) => hostLobby(ctx).control(cmd, groupId), true);
  on("game:action", (action) => {
    const a = ctx.current();
    if (!a || a.viewer.kind !== "player") fail("UNAUTHORIZED", "Join the lobby first.");
    a.lobby.action(a.viewer.playerId, action);
  });
}
