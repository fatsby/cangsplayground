import { fail } from "../auth/errors.js";
import type { HandlerContext, Register } from "./context.js";
export function registerSession(ctx: HandlerContext, on: Register) {
  on("player:avatar", ({ avatar }) => {
    const attachment = ctx.current();
    if (!attachment || attachment.viewer.kind !== "player")
      fail("UNAUTHORIZED", "Join the lobby first.");
    attachment.lobby.updateAvatar(attachment.viewer.playerId, avatar);
  });
  on("session:resume", ({ token }) => {
    const { lobby, player } = ctx.manager.resume(token);
    ctx.attach(lobby, { kind: "player", playerId: player.id });
    return { code: lobby.code, playerId: player.id };
  });
  on("session:leave", () => {
    const attachment = ctx.current();
    if (!attachment || attachment.viewer.kind !== "player")
      fail("UNAUTHORIZED", "Join the lobby first.");
    ctx.removePlayer(attachment.lobby, attachment.viewer.playerId, false);
  });
  on("time:sync", ({ clientNow }) => ({ clientNow, serverNow: ctx.manager.now() }));
}
