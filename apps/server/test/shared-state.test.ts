import { describe, expect, it, vi } from "vitest";
import { schemas } from "@cangsplayground/core";
import { buildView } from "../src/broadcast.js";
import { sharedGame, setupShared } from "./shared-game.js";
import { setupVote } from "./vote-game.js";

describe("session-wide shared state", () => {
  it("prepare stores prepareShared output", () => {
    const { lobby } = setupShared();
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2"] });
  });

  it("validateGroups blocks prepare", () => {
    const { lobby } = setupShared(3);
    lobby.control("exit");
    lobby.selectGame(sharedGame.id);
    lobby.assign("count", 1);
    expect(lobby.game!.shared).toBeNull();
    expect(() => lobby.control("prepare")).toThrow(/at least 2 groups/);
    expect(lobby.game!.stage).toBe("CONFIGURING");
  });

  it("routes player actions (not turn:done) to onSharedAction with the roster", () => {
    const { lobby, players } = setupShared();
    lobby.action(players[0]!.id, { type: "ping" });
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2", "player:ping:4"] });
    expect(() => lobby.action(players[0]!.id, { type: "turn:done" })).toThrow(/your turn/);
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2", "player:ping:4"] });
  });

  it("rejects when onSharedAction returns null", () => {
    const { lobby, players, log } = setupShared();
    expect(() => lobby.action(players[0]!.id, { type: "reject" })).toThrow(/not ready/);
    expect(() => lobby.hostAction({ type: "reject" })).toThrow(/not ready/);
    expect(log()).toEqual(["prepared:2"]);
  });

  it("hostAction routes with a host actor; fails for modules without onSharedAction", () => {
    const { lobby, log } = setupShared();
    const version = lobby.version;
    lobby.hostAction({ type: "next" });
    expect(log().at(-1)).toBe("host:next:4");
    expect(lobby.version).toBe(version + 1);
    expect(() => setupVote().lobby.hostAction({ type: "next" })).toThrow();
  });

  it("hostAction requires an active game", () => {
    const { lobby } = setupShared();
    lobby.control("exit");
    expect(() => lobby.hostAction({ type: "next" })).toThrow(/not ready/);
    lobby.selectGame(sharedGame.id);
    expect(() => lobby.hostAction({ type: "next" })).toThrow(/not ready/);
  });

  it("core controls other than prepare/exit are rejected for a shared game", () => {
    const { lobby } = setupShared();
    for (const cmd of [
      "start",
      "pause",
      "resume",
      "skip",
      "extend",
      "endRound",
      "reveal",
      "nextRound",
    ] as const)
      expect(() => lobby.control(cmd)).toThrow(/own controls/);
    expect(lobby.game!.groups.every((g) => g.phase === "PREPARED")).toBe(true);
    lobby.control("exit");
    expect(lobby.game).toBeNull();
  });

  it("removePlayer calls onSharedPlayerLeft with a roster without the leaver, and leaves runtimes/warnings alone", () => {
    const { lobby, players, log } = setupShared();
    const groups = structuredClone(lobby.game!.groups);
    lobby.removePlayer(players[1]!.id);
    expect(log().at(-1)).toBe(`left:${players[1]!.id}:3`);
    expect(lobby.warnings).toEqual([]);
    expect(lobby.game!.groups).toEqual(groups);
    expect(lobby.players.has(players[1]!.id)).toBe(false);
    expect(lobby.groups.flatMap((g) => g.playerIds)).not.toContain(players[1]!.id);
  });

  it("connectionChanged calls onSharedRosterChange on connect and disconnect", () => {
    const { lobby, players, log } = setupShared();
    const groups = structuredClone(lobby.game!.groups);
    const version = lobby.version;
    lobby.players.get(players[0]!.id)!.sockets.add("s1");
    lobby.connectionChanged();
    expect(log().at(-1)).toBe("roster:1");
    expect(lobby.version).toBe(version + 1);
    lobby.players.get(players[0]!.id)!.sockets.delete("s1");
    lobby.connectionChanged();
    expect(log().at(-1)).toBe("roster:0");
    expect(lobby.game!.groups).toEqual(groups);
  });

  it("connectionChanged leaves configuring and legacy games alone", () => {
    const { lobby } = setupShared();
    lobby.control("exit");
    lobby.selectGame(sharedGame.id);
    const version = lobby.version;
    lobby.connectionChanged();
    expect(lobby.game!.shared).toBeNull();
    expect(lobby.version).toBe(version);
    const legacy = setupVote().lobby;
    const legacyVersion = legacy.version;
    legacy.connectionChanged();
    expect(legacy.version).toBe(legacyVersion);
  });

  it("configure is rejected while a shared game is active", () => {
    const { lobby } = setupShared();
    expect(() => lobby.configure({})).toThrow(/Exit the game/);
    lobby.control("exit");
    lobby.selectGame(sharedGame.id);
    expect(() => lobby.configure({})).not.toThrow();
  });

  it("move is blocked while a shared game is active", () => {
    const { lobby, players } = setupShared();
    const otherGroupId = lobby.groups.find((g) => g.id !== players[0]!.groupId)!.id;
    expect(() => lobby.move(players[0]!.id, otherGroupId)).toThrow(/Exit the game/);
  });

  it("buildView exposes filtered shared state", () => {
    const { lobby, players } = setupShared();
    expect(buildView(lobby, { kind: "projector" }).game!.shared).toBeNull();
    const host = buildView(lobby, { kind: "host" });
    expect(host.game!.shared).toEqual({ log: ["prepared:2"] });
    expect(buildView(lobby, { kind: "player", playerId: players[0]!.id }).game!.shared).toEqual({
      log: ["prepared:2"],
    });
    (host.game!.shared as { log: string[] }).log.push("changed client view");
    expect(lobby.game!.shared).toEqual({ log: ["prepared:2"] });
    expect(buildView(setupVote().lobby, { kind: "host" }).game!.shared).toBeNull();
  });

  it("passes viewerGroupId to the shared filter", () => {
    const { lobby, players } = setupShared();
    const sharedViewFor = vi.fn(sharedGame.sharedViewFor!);
    lobby.game!.module = { ...sharedGame, sharedViewFor };
    buildView(lobby, { kind: "player", playerId: players[0]!.id });
    expect(sharedViewFor.mock.calls.at(-1)![0].viewerGroupId).toBe(players[0]!.groupId);
    buildView(lobby, { kind: "host" });
    expect(sharedViewFor.mock.calls.at(-1)![0].viewerGroupId).toBeNull();
  });

  it("does not call the shared filter before Prepare or with null shared state", () => {
    const { lobby } = setupShared();
    lobby.control("exit");
    lobby.selectGame(sharedGame.id);
    const sharedViewFor = vi.fn(sharedGame.sharedViewFor!);
    lobby.game!.module = { ...sharedGame, sharedViewFor };
    expect(buildView(lobby, { kind: "host" }).game!.shared).toBeNull();
    expect(sharedViewFor).not.toHaveBeenCalled();
    lobby.control("prepare");
    lobby.game!.shared = null;
    expect(buildView(lobby, { kind: "host" }).game!.shared).toBeNull();
    expect(sharedViewFor).not.toHaveBeenCalled();
  });

  it("defines host actions with the host command envelope", () => {
    expect(schemas["game:hostAction"].safeParse({ type: "next", commandId: "c1" }).success).toBe(
      true,
    );
    for (const payload of [
      { type: "next" },
      { type: "", commandId: "c1" },
      { type: "x".repeat(65), commandId: "c1" },
    ])
      expect(schemas["game:hostAction"].safeParse(payload).success).toBe(false);
  });
});
