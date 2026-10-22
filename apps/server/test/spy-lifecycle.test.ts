import { expect, it } from "vitest";
import { Lobby } from "../src/lobby/Lobby.js";
import { buildView } from "../src/broadcast.js";
import type { WhosTheSpyData } from "@cangsplayground/game-whos-the-spy";
function setup() {
  const lobby = new Lobby({ code: "ABC234", hostToken: "secret", seed: 3 });
  const players = Array.from({ length: 10 }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame("whos-the-spy");
  lobby.configure({ locationTopic: "airport" });
  lobby.assign("count", 2);
  lobby.control("prepare");
  lobby.control("start");
  return { lobby, players };
}
it("blocks active-game moves for spies, eliminated members and late joiners without changing state", () => {
  const { lobby } = setup();
  const [source, target] = lobby.game!.groups;
  const spies = (source!.data as WhosTheSpyData).spies;
  const civilian = source!.turnOrder.find((id) => !spies.includes(id))!;
  lobby.control("endRound", source!.groupId);
  const active = [...new Set(source!.turnOrder)];
  for (const id of active)
    lobby.action(id, {
      type: "vote",
      payload: { targetId: id === civilian ? spies[0] : civilian },
    });
  expect(source!.eliminated).toContain(civilian);
  const newcomer = lobby.join("Newcomer");
  const before = buildView(lobby, { kind: "host" });
  for (const playerId of [spies[0]!, civilian, newcomer.id]) {
    expect(() => lobby.move(playerId, target!.groupId)).toThrow("Exit the game to move players.");
    expect(buildView(lobby, { kind: "host" })).toEqual(before);
  }
});
it.each(["free-talk", "secret-word"])("preserves active moves for %s", (gameId) => {
  const lobby = new Lobby({ code: "ABC234", hostToken: "secret", seed: 3 });
  const players = Array.from({ length: 6 }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame(gameId);
  lobby.assign("count", 2);
  lobby.control("prepare");
  lobby.control("start");
  const player = players[0]!,
    target = lobby.groups.find((g) => g.id !== player.groupId)!;
  lobby.move(player.id, target.id);
  expect(player.groupId).toBe(target.id);
  expect(lobby.game!.groups.find((g) => g.groupId === target.id)!.turnOrder).toContain(player.id);
});
