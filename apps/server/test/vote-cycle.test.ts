import { voteGame, setupVote } from "./vote-game.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activePlayers } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";
import { buildView } from "../src/broadcast.js";
import { registry } from "../src/games/registry.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  registry.delete(voteGame.id);
});

describe("vote phase", () => {
  it("enters VOTING with a 30s timer after every member spoke twice", () => {
    const { lobby, group } = setupVote(3);
    lobby.control("start");
    for (let i = 0; i < 6; i++) lobby.control("skip");
    expect(group().phase).toBe("VOTING");
    expect(group().timer.durationMs).toBe(30_000);
    expect(group().timer.endsAt).toBe(Date.now() + 30_000);
    expect(buildView(lobby, { kind: "projector" }).game!.groups[0]!.currentSpeakerId).toBeNull();
  });
  it("closes on timer expiry, eliminates and goes to ROUND_END", () => {
    const { lobby, group } = setupVote(3);
    const timers = new TimerService(() => Date.now());
    lobby.onChange = () => timers.reconcile(lobby);
    lobby.control("start");
    lobby.control("endRound"); // "Vote now"
    expect(group().phase).toBe("VOTING");
    const first = activePlayers(group())[0]!;
    vi.advanceTimersByTime(30_000);
    expect(group().phase).toBe("ROUND_END");
    expect(group().eliminated).toEqual([first]);
    expect(group().turnOrder).not.toContain(first);
    expect(group().data).toEqual({ closes: 1 });
    timers.dispose();
  });
  it("closes early when the module says everyone voted", () => {
    const { lobby, players, group } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    lobby.action(players[0]!.id, { type: "everyone-voted" });
    expect(group().phase).toBe("ROUND_END");
  });
  it("pauses, resumes, extends and skips the vote timer without leaving VOTING", () => {
    const { lobby, group } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    vi.advanceTimersByTime(10_000);
    lobby.control("pause");
    expect(group().phase).toBe("VOTING");
    expect(group().timer).toMatchObject({ endsAt: null, pausedRemainingMs: 20_000 });
    lobby.control("resume");
    expect(group().timer.endsAt).toBe(Date.now() + 20_000);
    lobby.control("extend");
    expect(group().timer.endsAt).toBe(Date.now() + 50_000);
    lobby.control("skip");
    expect(group().phase).toBe("ROUND_END");
  });
  it("rejects endRound while VOTING and turn:done outside RUNNING", () => {
    const { lobby, players } = setupVote(3);
    lobby.control("start");
    lobby.control("endRound");
    expect(() => lobby.control("endRound")).toThrow("not ready");
    expect(() => lobby.action(players[0]!.id, { type: "turn:done" })).toThrow();
  });
});
describe("continue and leaving", () => {
  it("Continue keeps data, drops eliminated players, keeps order and starts RUNNING", () => {
    const prepare = vi.fn(() => ({ closes: 0 }));
    registry.set(voteGame.id, {
      ...voteGame,
      prepare,
      onContinue: ({ state }) => ({ closes: state.data.closes + 10 }),
    });
    const { lobby, group } = setupVote(4);
    lobby.control("start");
    const order = activePlayers(group());
    lobby.control("endRound");
    lobby.control("skip"); // close vote → eliminates order[0]
    lobby.control("nextRound", group().groupId);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(group()).toMatchObject({
      phase: "RUNNING",
      round: 2,
      turnIndex: 0,
      data: { closes: 11 },
    });
    expect(group().turnOrder).toEqual([...order.slice(1), ...order.slice(1)]);
  });
  it("onPlayerLeft can finish the group or close the vote", () => {
    registry.set(voteGame.id, {
      ...voteGame,
      onPlayerLeft: ({ state }) => ({ data: state.data, finished: true }),
    });
    const { lobby, players, group } = setupVote(3);
    lobby.control("start");
    lobby.removePlayer(players[2]!.id);
    expect(group().phase).toBe("FINISHED");
    expect(() => lobby.control("start")).toThrow("not ready");
    expect(() => lobby.control("nextRound")).toThrow("not ready");
  });
  it("closeVote from onPlayerLeft while VOTING", () => {
    registry.set(voteGame.id, {
      ...voteGame,
      onPlayerLeft: ({ state }) => ({ data: state.data, closeVote: true }),
    });
    const { lobby, players, group } = setupVote(4);
    lobby.control("start");
    lobby.control("endRound");
    lobby.removePlayer(players[3]!.id);
    expect(group().phase).toBe("ROUND_END");
  });
  it("leaving while VOTING does not end the vote by itself", () => {
    const { lobby, players, group } = setupVote(4);
    lobby.control("start");
    lobby.control("endRound");
    lobby.removePlayer(players[3]!.id);
    expect(group().phase).toBe("VOTING");
  });
});

it("resolveConfig runs once at prepare; validateGroup blocks prepare atomically", () => {
  const resolveConfig = vi.fn(({ config }) => ({ ...config, resolved: true }));
  registry.set(voteGame.id, {
    ...voteGame,
    resolveConfig,
    validateGroup: ({ group }) => (group.playerIds.length < 4 ? `${group.name} is small.` : null),
  });
  const lobby = new Lobby({ code: "ABC234", hostToken: "secret", seed: 1 });
  for (let i = 0; i < 3; i++) lobby.join(`P${i}`);
  lobby.selectGame(voteGame.id);
  lobby.assign("count", 1);
  expect(() => lobby.control("prepare")).toThrow("Team Red is small.");
  expect(lobby.game!.config).toEqual({});
  resolveConfig.mockClear();
  lobby.join("P3");
  lobby.assign("count", 1);
  lobby.control("prepare");
  expect(resolveConfig).toHaveBeenCalledTimes(1);
  expect(lobby.game!.config.resolved).toBe(true);
});

it.each(["endRound", "skip", "leave"] as const)(
  "opening a vote via %s while paused keeps its timer paused",
  (trigger) => {
    const { lobby, group } = setupVote(4);
    lobby.control("start");
    if (trigger !== "endRound") for (let i = 0; i < 7; i++) lobby.control("skip");
    lobby.control("pause");
    if (trigger === "leave") lobby.removePlayer(group().turnOrder[group().turnIndex]!);
    else lobby.control(trigger);
    expect(group().phase).toBe("VOTING");
    expect(group().timer).toEqual({ endsAt: null, pausedRemainingMs: 30_000, durationMs: 30_000 });
    lobby.control("resume");
    expect(group().timer.endsAt).toBe(Date.now() + 30_000);
  },
);
