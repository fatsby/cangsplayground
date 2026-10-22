import { afterEach, expect, it, vi } from "vitest";
import { registry } from "../src/games/registry.js";
import { setupVote, voteGame } from "./vote-game.js";
afterEach(() => {
  registry.delete(voteGame.id);
  vi.useRealTimers();
});

it("calls onTurnEnd for Done, Skip, expiry and module completion before moving the index, preserving the legacy expiry hook", () => {
  vi.useFakeTimers();
  registry.set(voteGame.id, {
    ...voteGame,
    prepare: () => ({ closes: 0, events: [] as string[] }),
    onTurnEnd: ({ state, reason }) => ({
      ...state.data,
      events: [
        ...state.data.events,
        `${reason}:${state.turnIndex}:${state.turnOrder[state.turnIndex]}`,
      ],
    }),
    onTimerEnd: ({ state }) => ({
      ...state.data,
      events: [
        ...state.data.events,
        `legacy:${state.turnIndex}:${state.turnOrder[state.turnIndex]}`,
      ],
    }),
    onAction: ({ state, action }) =>
      action.type === "finish" ? { data: state.data, endTurn: true } : null,
  });
  const { lobby, group } = setupVote(3);
  lobby.control("start");
  const [first, second, third] = group().turnOrder;
  lobby.action(first!, { type: "turn:done" });
  lobby.control("skip");
  const endsAt = group().timer.endsAt!;
  vi.advanceTimersByTime(10_000);
  lobby.expire(group().groupId, endsAt);
  lobby.action(first!, { type: "finish" });
  expect(group().data).toEqual({
    closes: 0,
    events: [
      `done:0:${first}`,
      `skip:1:${second}`,
      `legacy:2:${third}`,
      `timer:2:${third}`,
      `done:3:${first}`,
    ],
  });
  expect(group().turnIndex).toBe(4);
});
