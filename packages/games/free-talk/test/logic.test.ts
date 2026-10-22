import { describe, expect, it } from "vitest";
import { createRng, type GroupRuntime } from "@cangsplayground/core";
import freeTalk, { freeTalk as named } from "../src/index.js";

describe("Free Talk Timer", () => {
  it("exports a server module and valid form defaults", () => {
    expect(named).toBe(freeTalk);
    expect(freeTalk.id).toBe("free-talk");
    expect(freeTalk.configSchema.parse({})).toEqual(freeTalk.defaultConfig);
    expect(freeTalk.minPlayersPerGroup).toBe(2);
    expect(freeTalk.turnDurationMs(freeTalk.defaultConfig)).toBe(60000);
    expect(freeTalk.turnsPerPlayer!({ ...freeTalk.defaultConfig, turnsPerPlayer: 3 })).toBe(3);
    expect(freeTalk.configSchema.safeParse({ turnSeconds: 14 }).success).toBe(false);
  });
  it("starts empty, records the completed speaker, and exposes public data", () => {
    const config = { ...freeTalk.defaultConfig, prompt: "Your favourite food" };
    const data = freeTalk.prepare({
      config,
      group: { groupId: "g1", playerIds: ["a", "b"], round: 1 },
      rng: createRng(1),
    });
    expect(data).toEqual({ spoken: [] });
    const state: GroupRuntime<{ spoken: string[] }> = {
      groupId: "g1",
      phase: "RUNNING",
      round: 1,
      eliminated: [],
      turnOrder: ["a", "b"],
      turnIndex: 0,
      timer: { endsAt: 1, pausedRemainingMs: null, durationMs: 1 },
      revealed: false,
      data,
    };
    const next = freeTalk.onTurnEnd!({ config, state, reason: "timer" });
    expect(next).toEqual({ spoken: ["a"] });
    expect(data.spoken).toEqual([]);
    expect(freeTalk.publicInfo(config)).toEqual({ prompt: config.prompt, turnSeconds: 60 });
    for (const viewer of [
      { kind: "host" },
      { kind: "projector" },
      { kind: "player", playerId: "a" },
    ] as const) {
      expect(
        freeTalk.viewFor({ config, state: { ...state, data: next }, viewer, isMember: true }),
      ).toEqual(next);
    }
  });
});

it.each(["timer", "done", "skip"] as const)(
  "counts %s turn endings only when the player spoke",
  (reason) => {
    const state: GroupRuntime<{ spoken: string[] }> = {
      groupId: "g1",
      phase: "RUNNING",
      round: 1,
      eliminated: [],
      turnOrder: ["a", "b", "a"],
      turnIndex: 2,
      timer: { endsAt: 1, pausedRemainingMs: null, durationMs: 1 },
      revealed: false,
      data: { spoken: ["a"] },
    };
    const result = freeTalk.onTurnEnd!({ config: freeTalk.defaultConfig, state, reason });
    expect(result.spoken).toEqual(reason === "skip" ? ["a"] : ["a", "a"]);
    expect(state.data.spoken).toEqual(["a"]);
  },
);
it("does not count a turn with no current speaker", () => {
  const state: GroupRuntime<{ spoken: string[] }> = {
    groupId: "g1",
    phase: "RUNNING",
    round: 1,
    eliminated: [],
    turnOrder: [],
    turnIndex: 0,
    timer: { endsAt: 1, pausedRemainingMs: null, durationMs: 1 },
    revealed: false,
    data: { spoken: [] },
  };
  expect(freeTalk.onTurnEnd!({ config: freeTalk.defaultConfig, state, reason: "done" })).toEqual({
    spoken: [],
  });
});
