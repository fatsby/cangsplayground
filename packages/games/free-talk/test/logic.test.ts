import { describe, expect, it } from "vitest";
import { createRng, type GroupRuntime } from "@clubplay/core";
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
  it("starts empty, records only the expired speaker, and exposes public data", () => {
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
      turnOrder: ["a", "b"],
      turnIndex: 0,
      timer: { endsAt: 1, pausedRemainingMs: null, durationMs: 1 },
      revealed: false,
      data,
    };
    const next = freeTalk.onTimerEnd!({ config, state });
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
