import { afterEach, describe, expect, it, vi } from "vitest";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";
import { buildView } from "../src/broadcast.js";
import { schemas } from "@cangsplayground/core";

describe("player avatars", () => {
  const avatar = { seed: "new-look", backgroundColor: "e3edff", hairVariant: "shortHair" } as const;
  it("publishes a saved avatar to every viewer and preserves it through regrouping and reclaim", () => {
    const { lobby, players } = setup();
    const player = players[0]!;
    lobby.updateAvatar(player.id, avatar);
    lobby.assign("count", 2);
    for (const viewer of [
      { kind: "host" },
      { kind: "projector" },
      { kind: "player", playerId: player.id },
    ] as const)
      expect(buildView(lobby, viewer).players.find((p) => p.id === player.id)?.avatar).toEqual(
        avatar,
      );
    expect(lobby.join(player.name).avatar).toEqual(avatar);
  });
  it("rejects saves after game selection without changing the saved avatar, and allows editing after exit", () => {
    const { lobby, players } = setup();
    const player = players[0]!;
    lobby.updateAvatar(player.id, avatar);
    lobby.selectGame("free-talk");
    expect(() => lobby.updateAvatar(player.id, { seed: "other" })).toThrow(
      expect.objectContaining({ code: "INVALID_STATE" }),
    );
    expect(player.avatar).toEqual(avatar);
    lobby.control("exit");
    lobby.updateAvatar(player.id, { seed: "other" });
    expect(player.avatar).toEqual({ seed: "other" });
  });
  it("rejects unknown players and closed lobbies", () => {
    const { lobby, players } = setup();
    expect(() => lobby.updateAvatar("missing", avatar)).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
    lobby.status = "closed";
    expect(() => lobby.updateAvatar(players[0]!.id, avatar)).toThrow(
      expect.objectContaining({ code: "LOBBY_CLOSED" }),
    );
  });
  it("allows only supported appearance options and pastel backgrounds", () => {
    const schema = schemas["player:avatar"];
    expect(schema.safeParse({ avatar }).success).toBe(true);
    for (const invalid of [
      { ...avatar, backgroundColor: "000000" },
      { ...avatar, hairVariant: "unknown" },
      { ...avatar, seed: "" },
      { ...avatar, seed: "x".repeat(65) },
      { ...avatar, url: "https://example.com/face.svg" },
    ])
      expect(schema.safeParse({ avatar: invalid }).success).toBe(false);
    expect(schema.safeParse({ avatar, playerId: "someone-else" }).success).toBe(false);
  });
});

function setup(n = 4) {
  const lobby = new Lobby({
    code: "ABC234",
    hostToken: "host-secret-token",
    seed: 42,
    now: () => Date.now(),
  });
  const players = Array.from({ length: n }, (_, i) => lobby.join(`Player${i}`));
  return { lobby, players };
}
afterEach(() => vi.useRealTimers());
describe("Lobby and groups", () => {
  it("validates names, suggests a free name, enforces lock/full and removes kicked players", () => {
    const { lobby, players } = setup();
    expect(() => lobby.join("  ")).toThrow("name");
    players[0]!.sockets.add("online");
    expect(() => lobby.join(" player0 ")).toThrow(
      expect.objectContaining({
        code: "NAME_TAKEN",
        message: expect.stringContaining("If it's you, wait a minute"),
        suggestion: "player02",
      }),
    );
    lobby.locked = true;
    expect(() => lobby.join("New")).toThrow("locked");
    lobby.locked = false;
    for (let i = 4; i < 60; i++) lobby.join(`Player${i}`);
    expect(() => lobby.join("Full")).toThrow("full");
    lobby.removePlayer(players[0]!.id);
    expect(lobby.players.has(players[0]!.id)).toBe(false);
    expect(lobby.join("Player0").groupId).toBeNull();
  });
  it("joins with a full Vietnamese name and supports names up to 32 characters", () => {
    const { lobby } = setup(0);
    expect(lobby.join("Nguyễn Thị Phương Thảo").name).toBe("Nguyễn Thị Phương Thảo");
    expect(lobby.join("a".repeat(32)).name).toHaveLength(32);
    expect(() => lobby.join("a".repeat(33))).toThrow("name");
  });
  it("suggests unique duplicate-name suffixes within 32 characters, including two-digit suffixes", () => {
    const { lobby } = setup(0);
    const name = "a".repeat(32);
    lobby.join(name).sockets.add("online");
    for (let i = 2; i <= 10; i++) {
      const suggestion = "a".repeat(i < 10 ? 31 : 30) + i;
      expect(() => lobby.join(name)).toThrow(
        expect.objectContaining({
          code: "NAME_TAKEN",
          suggestion,
        }),
      );
      expect(lobby.join(suggestion).name).toHaveLength(32);
    }
  });
  it("lets an offline player reclaim their name, group and token even when locked or full", () => {
    const { lobby, players } = setup(60);
    lobby.assign("count", 2);
    const offline = players[0]!;
    lobby.locked = true;
    const reclaimed = lobby.join(" PLAYER0 ");
    expect(reclaimed).toBe(offline);
    expect(reclaimed).toMatchObject({ id: offline.id, token: offline.token });
    expect(reclaimed.groupId).not.toBeNull();
    expect(lobby.players.size).toBe(60);
    offline.sockets.add("online");
    expect(() => lobby.join("Player0")).toThrow("locked");
  });
  it("assigns balanced groups, validates minimums, moves members and requires confirmation", () => {
    const { lobby, players } = setup(8);
    lobby.selectGame("free-talk");
    expect(() => lobby.assign("count", 8)).toThrow("at least 2");
    expect(lobby.assign("count", 2)).toEqual({ sizes: [4, 4] });
    const target = lobby.groups.find((g) => g.id !== players[0]!.groupId)!;
    lobby.move(players[0]!.id, target.id);
    expect(players[0]!.groupId).toBe(target.id);
    lobby.control("prepare");
    expect(() => lobby.assign("count", 2)).toThrow("Confirm");
    lobby.assign("count", 2, true);
    expect(lobby.game).toBeNull();
    expect(lobby.groupsVersion).toBe(2);
  });
  it("keeps configuring games and gives late joiners no group", () => {
    const { lobby } = setup();
    lobby.selectGame("free-talk");
    lobby.configure({ prompt: "Hello" });
    lobby.assign("count", 2);
    expect(lobby.game!.config.prompt).toBe("Hello");
    lobby.join("Late");
    expect(buildView(lobby, { kind: "host" }).warnings).toContainEqual(
      expect.objectContaining({ code: "UNASSIGNED_PLAYERS" }),
    );
  });
});
describe("Lifecycle and timer", () => {
  it("rotates on expiry, pauses, resumes, extends, skips, reveals and starts a new round", () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const { lobby } = setup();
    const timer = new TimerService(() => Date.now());
    lobby.onChange = () => timer.reconcile(lobby);
    lobby.assign("count", 2);
    lobby.selectGame("free-talk");
    lobby.configure({ turnSeconds: 15 });
    lobby.control("prepare");
    expect(lobby.game!.groups[0]!.phase).toBe("PREPARED");
    lobby.control("start");
    const g = lobby.game!.groups[0]!;
    const first = g.turnOrder[0];
    vi.advanceTimersByTime(15000);
    expect(g.turnIndex).toBe(1);
    expect((g.data as { spoken: string[] }).spoken).toEqual([first]);
    lobby.control("pause");
    expect(g.timer.pausedRemainingMs).toBe(15000);
    lobby.control("extend");
    expect(g.timer.pausedRemainingMs).toBe(45000);
    vi.advanceTimersByTime(1000);
    lobby.control("resume");
    expect(g.timer.endsAt).toBe(Date.now() + 45000);
    lobby.control("skip");
    expect(g.phase).toBe("ROUND_END");
    lobby.control("reveal");
    expect(g.revealed).toBe(true);
    lobby.control("nextRound");
    expect(g.round).toBe(2);
    expect(g.phase).toBe("PREPARED");
    expect((g.data as { spoken: string[] }).spoken).toEqual([]);
    lobby.control("start");
    lobby.control("pause");
    lobby.control("skip");
    expect(g.phase).toBe("PAUSED");
    expect(g.timer.pausedRemainingMs).toBe(15000);
    lobby.control("endRound");
    lobby.control("exit");
    expect(lobby.game).toBeNull();
    expect(lobby.groups).toHaveLength(2);
    timer.dispose();
  });
  it("removes all future turns of a departing speaker and warns only the host", () => {
    const { lobby } = setup();
    lobby.assign("count", 1);
    lobby.selectGame("free-talk");
    lobby.configure({ turnsPerPlayer: 2 });
    lobby.control("prepare");
    lobby.control("start");
    const g = lobby.game!.groups[0]!;
    const speaker = g.turnOrder[0]!;
    lobby.removePlayer(speaker);
    expect(g.turnOrder).not.toContain(speaker);
    expect(g.turnIndex).toBe(0);
    expect(g.phase).toBe("RUNNING");
    expect(buildView(lobby, { kind: "host" }).warnings[0]?.code).toBe("PLAYER_LEFT_MID_ROUND");
  });
});
describe("filtered views", () => {
  it("exposes module control capabilities while configuring and playing", () => {
    const { lobby } = setup();
    lobby.assign("count", 1);
    lobby.selectGame("free-talk");
    expect(buildView(lobby, { kind: "host" }).game!.unsupportedControls).toEqual(["reveal"]);
    lobby.control("prepare");
    expect(buildView(lobby, { kind: "host" }).game!.unsupportedControls).toEqual(["reveal"]);
    lobby.control("exit");
    lobby.selectGame("secret-word");
    expect(buildView(lobby, { kind: "host" }).game!.unsupportedControls).toEqual([]);
  });
  it("contains no tokens, host config, or another group order in public/player views", () => {
    const { lobby, players } = setup(8);
    lobby.assign("count", 2);
    lobby.selectGame("free-talk");
    lobby.control("prepare");
    const p = players[0]!;
    const player = buildView(lobby, { kind: "player", playerId: p.id });
    const projector = buildView(lobby, { kind: "projector" });
    expect(player.game!.groups).toHaveLength(1);
    expect(player.game!.groups[0]!.groupId).toBe(p.groupId);
    expect(projector.game!.groups.every((g) => g.turnOrder === null)).toBe(true);
    for (const v of [player, projector]) {
      const json = JSON.stringify(v);
      expect(json).not.toContain(lobby.hostToken);
      for (const pl of players) expect(json).not.toContain(pl.token);
      expect(v.catalog).toEqual([]);
      expect(v.warnings).toEqual([]);
      expect(v.game!.config).toBeNull();
    }
    expect(buildView(lobby, { kind: "host" }).catalog.length).toBeGreaterThan(0);
  });
});

it("moves a current speaker as a skip, appends the new turn, and preserves paused state", () => {
  const { lobby } = setup(8);
  lobby.assign("count", 2);
  lobby.selectGame("free-talk");
  lobby.control("prepare");
  lobby.control("start");
  lobby.control("pause");
  const [from, to] = lobby.game!.groups;
  const speaker = from!.turnOrder[0]!;
  lobby.move(speaker, to!.groupId);
  expect(from!.turnOrder).not.toContain(speaker);
  expect(from!.turnIndex).toBe(0);
  expect(from!.phase).toBe("PAUSED");
  expect(from!.timer.pausedRemainingMs).toBe(60000);
  expect(to!.turnOrder.at(-1)).toBe(speaker);
  expect(lobby.players.get(speaker)!.groupId).toBe(to!.groupId);
});
it("applies new timing from the next turn and accepts Done only from the current speaker", () => {
  const { lobby } = setup();
  lobby.assign("count", 1);
  lobby.selectGame("free-talk");
  lobby.control("prepare");
  lobby.control("start");
  const group = lobby.game!.groups[0]!;
  const endsAt = group.timer.endsAt;
  lobby.configure({ turnSeconds: 30 });
  expect(group.timer.endsAt).toBe(endsAt);
  expect(() => lobby.action(group.turnOrder[1]!, { type: "turn:done" })).toThrow(
    "Wait for your turn",
  );
  const speaker = group.turnOrder[0]!;
  lobby.action(speaker, { type: "turn:done" });
  expect(group.turnIndex).toBe(1);
  expect(group.timer.durationMs).toBe(30000);
  expect((group.data as { spoken: string[] }).spoken).toEqual([speaker]);
});

it("rejects nextRound with INVALID_STATE when no requested group has ended", () => {
  const { lobby } = setup();
  lobby.assign("count", 1);
  lobby.selectGame("free-talk");
  lobby.control("prepare");
  for (const groupId of [undefined, "missing"]) {
    try {
      lobby.control("nextRound", groupId);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_STATE" });
    }
  }
});
it.each(["free-talk", "secret-word"])(
  "ends an empty PREPARED %s group when its last member leaves (S8)",
  (gameId) => {
    const { lobby, players } = setup(3);
    lobby.selectGame(gameId);
    lobby.assign("count", 1);
    lobby.control("prepare");
    const group = lobby.game!.groups[0]!;
    for (const player of players) lobby.removePlayer(player.id);
    expect(group.turnOrder).toEqual([]);
    expect(group.phase).toBe("ROUND_END");
    expect(() => lobby.control("start")).toThrow("not ready");
  },
);

it("Free Talk projector counts timer and Done completions but not host skips", () => {
  vi.useFakeTimers();
  const { lobby } = setup(3);
  lobby.assign("count", 1);
  lobby.selectGame("free-talk");
  lobby.control("prepare");
  lobby.control("start");
  const group = lobby.game!.groups[0]!,
    [first, , third] = group.turnOrder;
  lobby.action(first!, { type: "turn:done" });
  expect(buildView(lobby, { kind: "projector" }).game!.groups[0]!.data).toEqual({
    spoken: [first],
  });
  lobby.control("skip");
  const endsAt = group.timer.endsAt!;
  vi.advanceTimersByTime(60_000);
  lobby.expire(group.groupId, endsAt);
  expect(group.phase).toBe("ROUND_END");
  expect(buildView(lobby, { kind: "projector" }).game!.groups[0]!.data).toEqual({
    spoken: [first, third],
  });
});
