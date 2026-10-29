import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registry } from "../src/games/registry.js";
import { deadlineGame, setupDeadlines, testState } from "./shared-deadline-game.js";
import { setupShared } from "./shared-game.js";

let cleanup: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  for (const fn of cleanup) fn();
  cleanup = [];
  registry.delete(deadlineGame.id);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const env = setupDeadlines();
  cleanup.push(() => env.timers.dispose());
  return env;
}

describe("shared deadlines", () => {
  it("exports none while READY and two distinct deadlines once started", () => {
    const { lobby } = setup();
    expect(lobby.sharedDeadlines()).toEqual([]);
    lobby.hostAction({ type: "start" });
    expect(lobby.sharedDeadlines()).toEqual([
      { key: "match-a:vote", endsAt: 1_030_000 },
      { key: "match-b:vote", endsAt: 1_045_000 },
    ]);
  });

  it("expires each match on its own deadline with no client action", () => {
    const { lobby, players } = setup();
    for (const p of players) p.sockets.clear();
    lobby.hostAction({ type: "start" });
    const version = lobby.version;
    vi.advanceTimersByTime(29_999);
    expect(testState(lobby).expiredKeys).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
    expect(lobby.version).toBe(version + 1);
    vi.advanceTimersByTime(15_000);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote", "match-b:vote"]);
    // The play deadline starts from the expiry time, not the original start.
    vi.advanceTimersByTime(45_000);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote", "match-b:vote", "match-a:play"]);
  });

  it("pause cancels scheduled callbacks and resume re-arms the remaining time", () => {
    const { lobby, timers } = setup();
    lobby.hostAction({ type: "start" });
    vi.advanceTimersByTime(10_000);
    lobby.hostAction({ type: "pause" });
    expect(timers.keys().filter((k) => k.includes(":shared:"))).toEqual([]);
    vi.advanceTimersByTime(120_000);
    expect(testState(lobby).expiredKeys).toEqual([]);
    lobby.hostAction({ type: "resume" });
    vi.advanceTimersByTime(19_999);
    expect(testState(lobby).expiredKeys).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
  });

  it("an old session cannot mutate a replacement with the identical key and deadline", () => {
    const { lobby, timers } = setup();
    lobby.hostAction({ type: "start" });
    const oldSession = lobby.game!;
    const oldDeadline = lobby.sharedDeadlines()[0]!;
    lobby.control("exit");
    expect(timers.keys()).toEqual([]);
    lobby.selectGame(deadlineGame.id);
    lobby.control("prepare");
    lobby.hostAction({ type: "start" });
    expect(lobby.sharedDeadlines()[0]).toEqual(oldDeadline);
    vi.setSystemTime(oldDeadline.endsAt);
    expect(lobby.expireSharedDeadline(oldSession, oldDeadline)).toBe(false);
    expect(testState(lobby).expiredKeys).toEqual([]);
    expect(lobby.expireSharedDeadline(lobby.game!, oldDeadline)).toBe(true);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
  });

  it("a queued predecessor callback keeps the replacement's schedule, which fires once", () => {
    const callbacks: (() => void)[] = [];
    const real = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      callbacks.push(fn);
      return real(fn, ms);
    }) as typeof setTimeout);
    const { lobby, timers } = setup();
    lobby.hostAction({ type: "start" });
    const queued = callbacks.at(-2)!; // match-a's callback of the first session
    lobby.control("exit");
    lobby.selectGame(deadlineGame.id);
    lobby.control("prepare");
    lobby.hostAction({ type: "start" });
    const key = `${lobby.code}:shared:match-a:vote`;
    expect(timers.keys()).toContain(key);
    vi.setSystemTime(1_030_000);
    queued();
    expect(testState(lobby).expiredKeys).toEqual([]);
    expect(timers.keys()).toContain(key);
    vi.setSystemTime(1_000_000);
    vi.advanceTimersByTime(30_000);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
    vi.advanceTimersByTime(15_000);
    expect(testState(lobby).expiredKeys.filter((k) => k === "match-a:vote")).toHaveLength(1);
  });

  it("rejects early, unknown, duplicate and stale deadlines", () => {
    const { lobby } = setup();
    lobby.hostAction({ type: "start" });
    const session = lobby.game!;
    const deadline = lobby.sharedDeadlines()[0]!;
    expect(lobby.expireSharedDeadline(session, deadline)).toBe(false); // early
    vi.setSystemTime(deadline.endsAt);
    expect(lobby.expireSharedDeadline(session, { key: "nope", endsAt: deadline.endsAt })).toBe(
      false,
    );
    expect(lobby.expireSharedDeadline(session, { ...deadline, endsAt: deadline.endsAt - 1 })).toBe(
      false,
    );
    expect(lobby.expireSharedDeadline(session, deadline)).toBe(true);
    expect(lobby.expireSharedDeadline(session, deadline)).toBe(false); // duplicate
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
  });

  it("settles due deadlines before an action and publishes them even if it is rejected", () => {
    const { lobby, players } = setup();
    lobby.hostAction({ type: "start" });
    // No timers run: the wall clock jumps past both votes.
    vi.setSystemTime(1_050_000);
    const version = lobby.version;
    expect(() => lobby.action(players[0]!.id, { type: "reject" })).toThrow(/not ready/);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote", "match-b:vote"]);
    expect(lobby.version).toBe(version + 2);
    // Play deadlines restart from the settlement time.
    expect(lobby.sharedDeadlines().map((d) => d.endsAt)).toEqual([1_110_000, 1_110_000]);
  });

  it("settles before host actions, removals and roster changes", () => {
    const { lobby, players } = setup();
    lobby.hostAction({ type: "start" });
    vi.setSystemTime(1_030_000);
    lobby.hostAction({ type: "noop" });
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote"]);
    vi.setSystemTime(1_045_000);
    lobby.removePlayer(players[0]!.id);
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote", "match-b:vote"]);
    vi.setSystemTime(1_090_000);
    lobby.players.get(players[1]!.id)!.sockets.clear();
    lobby.connectionChanged();
    expect(testState(lobby).expiredKeys).toEqual(["match-a:vote", "match-b:vote", "match-a:play"]);
  });

  it("closing the lobby and disposing clear shared callbacks", () => {
    const { lobby, timers } = setup();
    lobby.hostAction({ type: "start" });
    lobby.status = "closed";
    timers.reconcile(lobby);
    expect(timers.keys()).toEqual([]);
    expect(lobby.sharedDeadlines()).toEqual([]);
    lobby.status = "open";
    timers.reconcile(lobby);
    expect(timers.keys()).toHaveLength(2);
    timers.dispose();
    vi.advanceTimersByTime(60_000);
    expect(testState(lobby).expiredKeys).toEqual([]);
  });

  it("modules without deadline hooks export none", () => {
    const { lobby } = setupShared();
    expect(lobby.sharedDeadlines()).toEqual([]);
    expect(() => lobby.settleSharedDeadlines()).not.toThrow();
  });
});
