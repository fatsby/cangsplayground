import { hostLobby, type HandlerContext, type Register } from "./context.js";
export function registerGroups(ctx: HandlerContext, on: Register) {
  on(
    "groups:assign",
    ({ mode, value, confirm }) => hostLobby(ctx).assign(mode, value, confirm),
    true,
  );
  on("groups:move", ({ playerId, toGroupId }) => hostLobby(ctx).move(playerId, toGroupId), true);
}
