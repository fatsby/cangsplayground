import { afterEach, expect, it, vi } from "vitest";
import { registry } from "../src/games/registry.js";
import { setupVote, voteGame } from "./vote-game.js";

afterEach(() => {
  registry.delete(voteGame.id);
  vi.useRealTimers();
});

it.each([false, true])(
  "nextRound clears only that group's departure warnings (Continue: %s)",
  (continues) => {
    registry.set(voteGame.id, {
      ...voteGame,
      ...(continues ? { onContinue: ({ state }) => state.data } : {}),
    });
    const { lobby } = setupVote(10, 2);
    const [first, second] = lobby.game!.groups;
    lobby.control("start");
    lobby.removePlayer(first!.turnOrder[0]!);
    lobby.removePlayer(second!.turnOrder[0]!);
    lobby.warnings.push({
      code: "GROUPS_TOO_SMALL",
      message: "Keep this warning.",
      groupId: first!.groupId,
    });
    const remaining = lobby.warnings.filter(
      (w) => w.groupId !== first!.groupId || w.code !== "PLAYER_LEFT_MID_ROUND",
    );
    expect(lobby.warnings.filter((w) => w.code === "PLAYER_LEFT_MID_ROUND")).toHaveLength(2);
    lobby.control("endRound", first!.groupId);
    lobby.control("skip", first!.groupId);
    lobby.control("nextRound", first!.groupId);
    expect(lobby.warnings).toEqual(remaining);
  },
);

it("finishing on a departure clears the group's warnings and later departures cannot restore them", () => {
  let finishedId = "";
  registry.set(voteGame.id, {
    ...voteGame,
    onPlayerLeft: ({ state }) => ({ data: state.data, finished: state.groupId === finishedId }),
  });
  const { lobby } = setupVote(10, 2);
  const [first, second] = lobby.game!.groups;
  finishedId = first!.groupId;
  lobby.control("start");
  lobby.removePlayer(second!.turnOrder[0]!);
  const remaining = [...lobby.warnings];
  lobby.removePlayer(first!.turnOrder[0]!);
  expect(first!.phase).toBe("FINISHED");
  expect(lobby.warnings).toEqual(remaining);
  lobby.removePlayer(first!.turnOrder[0]!);
  expect(lobby.warnings).toEqual(remaining);
});

it("finishing a vote clears only that group's departure warnings", () => {
  registry.set(voteGame.id, {
    ...voteGame,
    onVoteEnd: ({ state }) => ({ data: state.data, finished: true }),
  });
  const { lobby } = setupVote(10, 2);
  const [first, second] = lobby.game!.groups;
  lobby.control("start");
  lobby.removePlayer(second!.turnOrder[0]!);
  const remaining = [...lobby.warnings];
  lobby.removePlayer(first!.turnOrder[0]!);
  lobby.control("endRound", first!.groupId);
  lobby.control("skip", first!.groupId);
  expect(first!.phase).toBe("FINISHED");
  expect(lobby.warnings).toEqual(remaining);
});

it("clock expiry clears every finished group's departure warnings while keeping unrelated warnings", () => {
  vi.useFakeTimers();
  registry.set(voteGame.id, { ...voteGame, gameDurationMs: () => 1000 });
  const { lobby } = setupVote(10, 2);
  lobby.control("start");
  for (const group of lobby.game!.groups) lobby.removePlayer(group.turnOrder[0]!);
  const other = { code: "GROUPS_TOO_SMALL" as const, message: "Keep this warning." };
  lobby.warnings.push(other);
  const endsAt = lobby.game!.clock!.timer.endsAt!;
  vi.advanceTimersByTime(1000);
  lobby.expireClock(endsAt);
  expect(lobby.game!.groups.every((g) => g.phase === "FINISHED")).toBe(true);
  expect(lobby.warnings).toEqual([other]);
});

it("exit still clears every warning", () => {
  const { lobby } = setupVote(4);
  lobby.removePlayer(lobby.game!.groups[0]!.turnOrder[0]!);
  lobby.warnings.push({ code: "GROUPS_TOO_SMALL", message: "Too small." });
  lobby.control("exit");
  expect(lobby.warnings).toEqual([]);
});
