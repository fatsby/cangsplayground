import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuessShared, GuessView } from "@cangsplayground/game-guess-the-character";
import { buildView } from "../src/broadcast.js";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";

let timers: TimerService;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  timers = new TimerService(() => Date.now());
});
afterEach(() => {
  timers.dispose();
  vi.useRealTimers();
});

function setup(players = 4, groups = 2, config: Record<string, unknown> = {}) {
  const lobby = new Lobby({ code: "GTC234", hostToken: "host-secret-token", seed: 7 });
  lobby.onChange = () => timers.reconcile(lobby);
  const list = Array.from({ length: players }, (_, i) => lobby.join(`Student ${i}`));
  for (const [i, p] of list.entries()) p.sockets.add(`s${i}`);
  lobby.selectGame("guess-the-character");
  if (Object.keys(config).length) lobby.configure(config);
  lobby.assign("count", groups);
  return { lobby, players: list };
}
const shared = (lobby: Lobby) => lobby.game!.shared as GuessShared;
const guardOf = (lobby: Lobby, i = 0) => {
  const m = shared(lobby).matches[i]!;
  return { round: shared(lobby).round, matchId: m.id, phaseVersion: m.phaseVersion };
};

describe("Guess the Character through the Lobby", () => {
  it("rejects an odd number of groups at Prepare with a clear message", () => {
    const { lobby } = setup(3, 3);
    expect(() => lobby.control("prepare")).toThrow(/even number of groups.*Make 2 or 4/);
    expect(lobby.game!.stage).toBe("CONFIGURING");
  });

  it("supports single-player groups and keeps legacy runtimes idle", () => {
    const { lobby } = setup(2, 2);
    lobby.control("prepare");
    expect(shared(lobby).matches).toHaveLength(1);
    expect(lobby.game!.groups.every((g) => g.phase === "PREPARED" && g.timer.endsAt === null)).toBe(
      true,
    );
    for (const cmd of ["start", "pause", "skip"] as const)
      expect(() => lobby.control(cmd)).toThrow(/own controls/);
  });

  it("locks settings once the shared session is active", () => {
    const { lobby } = setup(4, 2, { turnSeconds: 15 });
    lobby.control("prepare");
    expect(() => lobby.configure({ turnSeconds: 30 })).toThrow(/Exit the game/);
    expect(lobby.game!.config).toEqual({ voteSeconds: 30, turnSeconds: 15, cooldownSeconds: 5 });
  });

  it("advances vote and turns on the server clock with nobody connected", () => {
    const { lobby, players } = setup(4, 2, { voteSeconds: 10, turnSeconds: 15 });
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    // Phones stay connected but idle; no client sends anything.
    vi.advanceTimersByTime(10_000);
    const m = shared(lobby).matches[0]!;
    expect(m.phase).toBe("PLAYING");
    const firstTurn = m.turnId;
    vi.advanceTimersByTime(15_000);
    expect(shared(lobby).matches[0]!.turnId).toBe(firstTurn + 1);
    for (const p of players) p.sockets.clear();
    lobby.connectionChanged();
    vi.advanceTimersByTime(15_000);
    // Nobody online at the boundary: paused for the host, no further timers.
    expect(shared(lobby).matches[0]).toMatchObject({ paused: true, pauseReason: "offline" });
    expect(timers.keys().filter((k) => k.includes(":shared:"))).toEqual([]);
  });

  it("routes player and host actions with settlement and rejects host-only actions from players", () => {
    const { lobby, players } = setup(4, 2);
    lobby.control("prepare");
    expect(() => lobby.action(players[0]!.id, { type: "gc:start", payload: { round: 1 } })).toThrow(
      /not ready/,
    );
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    lobby.action(players[0]!.id, {
      type: "gc:vote",
      payload: { ...guardOf(lobby), categoryId: "superheroes" },
    });
    expect(shared(lobby).matches[0]!.votes[players[0]!.id]).toBe("superheroes");
    vi.setSystemTime(1_030_000); // the timer has not run yet; the action settles it first
    expect(() =>
      lobby.action(players[1]!.id, {
        type: "gc:vote",
        payload: { ...guardOf(lobby), phaseVersion: 1, categoryId: "anime-manga" },
      }),
    ).toThrow(/not ready/);
    expect(shared(lobby).matches[0]!.phase).toBe("PLAYING");
    expect(shared(lobby).matches[0]!.categoryId).toBe("superheroes");
  });

  it("filters the broadcast view per viewer", () => {
    const { lobby, players } = setup(4, 2);
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    vi.advanceTimersByTime(30_000);
    const m = shared(lobby).matches[0]!;
    const [a] = m.teams[0].members;
    const mine = buildView(lobby, { kind: "player", playerId: a! }).game!.shared as GuessView;
    expect(mine.privateMatches[0]!.characters[0]!.character?.id).toBe(m.teams[0].characterId);
    expect(mine.privateMatches[0]!.characters[1]!.character).toBeNull();
    const projector = buildView(lobby, { kind: "projector" }).game!.shared as GuessView;
    expect(projector.privateMatches).toEqual([]);
    expect(JSON.stringify(buildView(lobby, { kind: "projector" }))).not.toContain(
      `"${m.teams[1].characterId}"`,
    );
    expect(players).toHaveLength(4);
  });

  it("a removed student's same-name rejoin gets a new ID and no rights", () => {
    const { lobby, players } = setup(4, 2);
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    const leaver = players[0]!;
    lobby.removePlayer(leaver.id);
    const back = lobby.join(leaver.name);
    expect(back.id).not.toBe(leaver.id);
    back.sockets.add("s-new");
    expect(() =>
      lobby.action(back.id, {
        type: "gc:vote",
        payload: { ...guardOf(lobby), categoryId: "superheroes" },
      }),
    ).toThrow();
    const view = buildView(lobby, { kind: "player", playerId: back.id }).game!.shared as GuessView;
    expect(view.privateMatches).toEqual([]);
    expect(view.ownMatchId).toBeNull();
  });

  it("New round needs every match over and re-pairs from the current groups", () => {
    const { lobby } = setup(8, 4);
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    expect(() => lobby.hostAction({ type: "gc:newRound", payload: { round: 1 } })).toThrow();
    for (const m of shared(lobby).matches)
      lobby.hostAction({
        type: "gc:end",
        payload: { round: 1, matchId: m.id, phaseVersion: m.phaseVersion, turnId: m.turnId },
      });
    lobby.hostAction({ type: "gc:newRound", payload: { round: 1 } });
    expect(shared(lobby).round).toBe(2);
    expect(shared(lobby).matches.every((m) => m.phase === "CATEGORY_VOTE")).toBe(true);
    expect(lobby.sharedDeadlines()).toHaveLength(2);
  });

  it("exit and re-Prepare leave no stale callback acting on the new session", () => {
    const { lobby } = setup(4, 2);
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    const old = lobby.game!;
    const oldDeadline = lobby.sharedDeadlines()[0]!;
    lobby.control("exit");
    lobby.selectGame("guess-the-character");
    lobby.control("prepare");
    lobby.hostAction({ type: "gc:start", payload: { round: 1 } });
    vi.setSystemTime(oldDeadline.endsAt);
    expect(lobby.expireSharedDeadline(old, oldDeadline)).toBe(false);
    expect(shared(lobby).matches[0]!.phase).toBe("CATEGORY_VOTE");
  });
});
