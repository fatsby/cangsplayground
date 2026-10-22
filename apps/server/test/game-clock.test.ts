import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { voteGame, setupVote } from "./vote-game.js";
import { registry } from "../src/games/registry.js";
import { TimerService } from "../src/timer/TimerService.js";
import { buildView } from "../src/broadcast.js";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  registry.delete(voteGame.id);
});
it("starts on first start, pauses only for whole-class pause, ends every unfinished group", () => {
  const onGameTimeUp = vi.fn(() => ({ closes: -1 }));
  registry.set(voteGame.id, { ...voteGame, gameDurationMs: () => 120_000, onGameTimeUp });
  const { lobby } = setupVote(6, 2);
  const timers = new TimerService(() => Date.now());
  lobby.onChange = () => timers.reconcile(lobby);
  expect(lobby.game!.clock!.timer.endsAt).toBeNull();
  lobby.control("start");
  expect(lobby.game!.clock!.timer.endsAt).toBe(Date.now() + 120_000);
  const [g1] = lobby.game!.groups;
  lobby.control("pause", g1!.groupId);
  expect(lobby.game!.clock!.timer.endsAt).not.toBeNull();
  lobby.control("pause");
  expect(lobby.game!.clock!.timer).toMatchObject({ endsAt: null, pausedRemainingMs: 120_000 });
  lobby.control("resume");
  vi.advanceTimersByTime(120_000);
  expect(lobby.game!.groups.map((g) => g.phase)).toEqual(["FINISHED", "FINISHED"]);
  expect(onGameTimeUp).toHaveBeenCalledTimes(2);
  expect(buildView(lobby, { kind: "projector" }).game!.clock).toMatchObject({ done: true });
  timers.dispose();
});
it("groups already FINISHED keep their data; ROUND_END groups still finish", () => {
  const onGameTimeUp = vi.fn(() => ({ closes: -1 }));
  registry.set(voteGame.id, {
    ...voteGame,
    gameDurationMs: () => 120_000,
    onGameTimeUp,
    onPlayerLeft: ({ state }) => ({ data: state.data, finished: true }),
  });
  const { lobby, players } = setupVote(6, 2);
  lobby.control("start");
  const [g1, g2] = lobby.game!.groups;
  lobby.removePlayer(players.find((p) => p.groupId === g1!.groupId)!.id);
  const data = structuredClone(g1!.data);
  lobby.control("endRound", g2!.groupId);
  lobby.control("skip", g2!.groupId);
  vi.advanceTimersByTime(120_000);
  lobby.expireClock(lobby.game!.clock!.timer.endsAt!);
  expect(g1!.data).toEqual(data);
  expect(g2!.phase).toBe("FINISHED");
  expect(onGameTimeUp).toHaveBeenCalledTimes(1);
});
it("modules without gameDurationMs have clock null", () => {
  const { lobby } = setupVote(3);
  expect(buildView(lobby, { kind: "host" }).game!.clock).toBeNull();
});

it("clock expiry finishes paused and prepared groups and ignores stale callbacks", () => {
  registry.set(voteGame.id, {
    ...voteGame,
    gameDurationMs: () => 120_000,
    onGameTimeUp: () => ({ closes: -1 }),
  });
  const { lobby } = setupVote(6, 2);
  const [g1, g2] = lobby.game!.groups;
  lobby.control("start", g1!.groupId);
  lobby.control("pause", g1!.groupId);
  const endsAt = lobby.game!.clock!.timer.endsAt!;
  lobby.expireClock(endsAt - 1);
  expect(g1!.phase).toBe("PAUSED");
  vi.advanceTimersByTime(120_000);
  lobby.expireClock(endsAt);
  expect(g1!.phase).toBe("FINISHED");
  expect(g2!.phase).toBe("FINISHED");
});
