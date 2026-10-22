import { z } from "zod";
import { activePlayers, type GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { registry } from "../src/games/registry.js";
type D = { closes: number };
export const voteGame: GameModule<Record<string, never>, D> = {
  id: "test-vote",
  name: "Test vote",
  description: "",
  minPlayersPerGroup: 2,
  recommended: "",
  configSchema: z.object({}),
  defaultConfig: {},
  configFields: [],
  turnDurationMs: () => 10_000,
  turnsPerPlayer: () => 2,
  voteDurationMs: () => 30_000,
  prepare: () => ({ closes: 0 }),
  onAction: ({ state, action }) =>
    action.type === "everyone-voted" && state.phase === "VOTING"
      ? { data: state.data, closeVote: true }
      : null,
  onVoteEnd: ({ state }) => ({
    data: { closes: state.data.closes + 1 },
    eliminate: [activePlayers(state)[0]!],
  }),
  publicInfo: () => ({}),
  viewFor: ({ state }) => state.data,
};
export function setupVote(n = 3, groups = 1) {
  if (!registry.has(voteGame.id)) registry.set(voteGame.id, voteGame);
  const lobby = new Lobby({
    code: "ABC234",
    hostToken: "host-secret-token",
    seed: 1,
    now: () => Date.now(),
  });
  const players = Array.from({ length: n }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame(voteGame.id);
  lobby.assign("count", groups);
  lobby.control("prepare");
  return { lobby, players, group: () => lobby.game!.groups[0]! };
}
