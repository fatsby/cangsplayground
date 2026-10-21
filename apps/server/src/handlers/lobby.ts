import type { HandlerContext, Register } from "./context.js";
import { hostLobby } from "./context.js";
export function registerLobby(ctx: HandlerContext, on: Register) {
  const { manager } = ctx;
  on("lobby:create", () => {
    const lobby = manager.create();
    return { code: lobby.code, hostToken: lobby.hostToken };
  });
  on("display:watch", ({ code }) => {
    const lobby = manager.get(code);
    ctx.attach(lobby, { kind: "projector" });
    lobby.touch();
  });
  on("host:pair", ({ code, hostToken }) => {
    const lobby = manager.authenticate(code, hostToken);
    lobby.touch();
    return manager.pairing.create(code);
  });
  on("host:claim", ({ code, pairToken }) => {
    const lobby = manager.get(code);
    manager.pairing.claim(code, pairToken);
    lobby.touch();
    return { hostToken: lobby.hostToken };
  });
  on("host:attach", ({ code, hostToken }) => {
    const lobby = manager.authenticate(code, hostToken);
    ctx.attach(lobby, { kind: "host" });
  });
  on("lobby:join", ({ code, name }) => {
    const { lobby, player } = manager.join(code, name);
    ctx.attach(lobby, { kind: "player", playerId: player.id });
    return { playerToken: player.token, playerId: player.id };
  });
  on(
    "lobby:lock",
    ({ locked }) => {
      const lobby = hostLobby(ctx);
      lobby.locked = locked;
      lobby.changed();
    },
    true,
  );
  on("lobby:kick", ({ playerId }) => ctx.removePlayer(hostLobby(ctx), playerId, true), true);
  on("lobby:close", () => manager.close(hostLobby(ctx), "host"), true);
}
