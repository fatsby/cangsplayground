import { describe, expect, it } from "vitest";
import { z } from "zod";
import { catalogEntry, type GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { registry } from "../src/games/registry.js";

type Shared = { log: string[] };

function makeGame(id: string, wholeLobby: boolean): GameModule<Record<string, never>, null, Shared> {
  return {
    id,
    name: id,
    description: "",
    minPlayersPerGroup: 2,
    recommended: "",
    ...(wholeLobby ? { wholeLobby: true } : {}),
    configSchema: z.object({}),
    defaultConfig: {},
    configFields: [],
    turnDurationMs: () => null,
    prepare: () => null,
    prepareShared: ({ groups }) => ({ log: [`prepared:${groups.length}:${groups[0]?.playerIds.length}`] }),
    onSharedAction: ({ shared }) => shared,
    onSharedPlayerJoined: ({ shared, playerId }) => ({ log: [...shared.log, `joined:${playerId}`] }),
    sharedViewFor: ({ shared }) => shared,
    publicInfo: () => ({}),
    viewFor: () => null,
  };
}

function setup(game: GameModule, players = 4) {
  registry.set(game.id, game);
  const lobby = new Lobby({ code: "ABC234", hostToken: "host-secret-token", seed: 1, now: () => Date.now() });
  const joined = Array.from({ length: players }, (_, i) => lobby.join(`P${i}`));
  lobby.selectGame(game.id);
  return { lobby, joined, log: () => (lobby.game!.shared as Shared).log };
}

describe("whole-lobby games", () => {
  it("prepare puts every ungrouped player into exactly one group", () => {
    const { lobby, joined, log } = setup(makeGame("test-whole", true));
    expect(lobby.groups).toHaveLength(0);
    lobby.control("prepare");
    expect(lobby.groups).toHaveLength(1);
    expect(lobby.groups[0]!.playerIds.sort()).toEqual(joined.map((p) => p.id).sort());
    expect(joined.every((p) => p.groupId === lobby.groups[0]!.id)).toBe(true);
    expect(log()).toEqual(["prepared:1:4"]);
  });

  it("exposes the flag in the host catalog", () => {
    expect(catalogEntry(makeGame("test-whole", true)).wholeLobby).toBe(true);
    expect(catalogEntry(makeGame("test-grouped", false)).wholeLobby).toBe(false);
  });
});

describe("late join into a running game", () => {
  it("adds the player to the single group and calls onSharedPlayerJoined once", () => {
    const { lobby, log } = setup(makeGame("test-whole", true));
    lobby.control("prepare");
    const late = lobby.join("Late");
    expect(late.groupId).toBe(lobby.groups[0]!.id);
    expect(lobby.groups[0]!.playerIds).toContain(late.id);
    expect(lobby.game!.groups[0]!.turnOrder).toContain(late.id);
    expect(log().filter((l) => l.startsWith("joined:"))).toEqual([`joined:${late.id}`]);
  });

  it("two joiners are both admitted, in order", () => {
    const { lobby, log } = setup(makeGame("test-whole", true));
    lobby.control("prepare");
    const a = lobby.join("A1");
    const b = lobby.join("B1");
    expect(log().slice(1)).toEqual([`joined:${a.id}`, `joined:${b.id}`]);
  });

  it("reclaiming an offline player by name does not count as a join", () => {
    const { lobby, joined, log } = setup(makeGame("test-whole", true));
    lobby.control("prepare");
    const again = lobby.join("P0");
    expect(again.id).toBe(joined[0]!.id);
    expect(log()).toEqual(["prepared:1:4"]);
  });

  it("a game without wholeLobby leaves the joiner ungrouped and never calls the hook", () => {
    const { lobby, log } = setup(makeGame("test-grouped", false));
    lobby.assign("count", 2);
    lobby.control("prepare");
    const late = lobby.join("Late");
    expect(late.groupId).toBeNull();
    expect(log().some((l) => l.startsWith("joined:"))).toBe(false);
  });

  it("a locked lobby still refuses new players", () => {
    const { lobby } = setup(makeGame("test-whole", true));
    lobby.control("prepare");
    lobby.locked = true;
    expect(() => lobby.join("Late")).toThrow(/locked/i);
  });
});
