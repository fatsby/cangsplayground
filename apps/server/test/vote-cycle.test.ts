import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { activePlayers, type GameModule } from "@cangsplayground/core";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";
import { buildView } from "../src/broadcast.js";
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
