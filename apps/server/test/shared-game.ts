import { z } from "zod";
import type { GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { registry } from "../src/games/registry.js";

export const sharedGame: GameModule<Record<string, never>, null, { log: string[] }> = {
  id: "test-shared",
  name: "Test shared",
  description: "",
  minPlayersPerGroup: 1,
  recommended: "",
  configSchema: z.object({}),
  defaultConfig: {},
  configFields: [],
  turnDurationMs: () => null,
  prepare: () => null,
  prepareShared: ({ groups }) => ({ log: [`prepared:${groups.length}`] }),
  onSharedAction: ({ shared, action, actor, roster }) =>
    action.type === "reject"
      ? null
      : { log: [...shared.log, `${actor.kind}:${action.type}:${roster.length}`] },
  onSharedPlayerLeft: ({ shared, playerId, roster }) => ({
    log: [...shared.log, `left:${playerId}:${roster.length}`],
  }),
  onSharedRosterChange: ({ shared, roster }) => ({
    log: [...shared.log, `roster:${roster.filter((r) => r.connected).length}`],
  }),
  sharedViewFor: ({ shared, viewer }) => (viewer.kind === "projector" ? null : shared),
  validateGroups: ({ groups }) => (groups.length < 2 ? "Make at least 2 groups." : null),
  publicInfo: () => ({}),
  viewFor: () => null,
};

export function setupShared(n = 4, groups = 2) {
  if (!registry.has(sharedGame.id)) registry.set(sharedGame.id, sharedGame);
  const lobby = new Lobby({
    code: "ABC234",
    hostToken: "host-secret-token",
    seed: 1,
    now: () => Date.now(),
  });
  const players = Array.from({ length: n }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame(sharedGame.id);
  lobby.assign("count", groups);
  lobby.control("prepare");
  return { lobby, players, log: () => (lobby.game!.shared as { log: string[] }).log };
}
