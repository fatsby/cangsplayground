import { createRng, type GroupRuntime } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import { secretWord, type SecretWordData } from "../src/index.js";

const config = secretWord.defaultConfig;
const players = ["a", "b", "c", "d"];

function runtime(revealed = false): GroupRuntime<SecretWordData> {
  const data = secretWord.prepare({
    config,
    group: { groupId: "g1", playerIds: players, round: 1 },
    rng: createRng(7),
  });
  return {
    groupId: "g1",
    phase: revealed ? "ROUND_END" : "RUNNING",
    round: 1,
    eliminated: [],
    turnOrder: players,
    turnIndex: 0,
    timer: { endsAt: null, pausedRemainingMs: null, durationMs: 45_000 },
    revealed,
    data,
  };
}

describe("secret-word", () => {
  it("deals a different word to each member", () => {
    const { words } = runtime().data;
    expect(Object.keys(words).sort()).toEqual(players);
    expect(new Set(Object.values(words)).size).toBe(players.length);
  });

  it("projector sees no words before reveal", () => {
    const view = secretWord.viewFor({
      config,
      state: runtime(),
      viewer: { kind: "projector" },
      isMember: false,
    });
    expect(view).toEqual({ myWord: null, words: null });
  });

  it("a player sees only their own word before reveal", () => {
    const state = runtime();
    const view = secretWord.viewFor({
      config,
      state,
      viewer: { kind: "player", playerId: "b" },
      isMember: true,
    });
    expect(view).toEqual({ myWord: state.data.words.b, words: null });
    expect(JSON.stringify(view)).not.toContain(state.data.words.a);
  });

  it("host sees every word; everyone sees all words after reveal", () => {
    const state = runtime(true);
    expect(
      secretWord.viewFor({ config, state: runtime(), viewer: { kind: "host" }, isMember: false }),
    ).toMatchObject({
      words: runtime().data.words,
    });
    expect(
      secretWord.viewFor({ config, state, viewer: { kind: "projector" }, isMember: false }),
    ).toEqual({
      myWord: null,
      words: state.data.words,
    });
  });

  it("parses partial config with defaults", () => {
    expect(secretWord.configSchema.parse({ level: "medium" })).toEqual({
      level: "medium",
      turnSeconds: 45,
    });
  });
});
