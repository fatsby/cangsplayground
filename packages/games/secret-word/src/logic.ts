import { shuffle, type GameModule } from "@clubplay/core";
import wordBank from "../data/words.json" with { type: "json" };
import {
  GAME_ID,
  configSchema,
  type SecretWordConfig,
  type SecretWordData,
  type SecretWordGroupView,
  type SecretWordPublicInfo,
} from "./types.js";

export const secretWord: GameModule<SecretWordConfig, SecretWordData> = {
  id: GAME_ID,
  name: "Secret Word",
  description: "Everyone gets a secret word. Use it when you speak. Can your group find it?",
  minPlayersPerGroup: 3,
  recommended: "3–6 per group",

  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    {
      key: "level",
      label: "Word level",
      kind: "select",
      options: [
        { value: "easy", label: "Easy" },
        { value: "medium", label: "Medium" },
      ],
    },
    {
      key: "turnSeconds",
      label: "Time per turn",
      kind: "number",
      min: 15,
      max: 300,
      step: 15,
      unit: "sec",
    },
  ],

  turnDurationMs: (config) => config.turnSeconds * 1000,

  prepare({ config, group, rng }) {
    // Unique words inside a group; the bank is larger than the 60-player lobby cap per level.
    const bank = shuffle(wordBank[config.level], rng);
    const members = [...new Set(group.playerIds)];
    const words: Record<string, string> = {};
    members.forEach((id, i) => {
      words[id] = bank[i % bank.length]!;
    });
    return { words };
  },

  publicInfo: (config): SecretWordPublicInfo => ({
    level: config.level,
    turnSeconds: config.turnSeconds,
  }),

  viewFor({ state, viewer, isMember }): SecretWordGroupView {
    const { words } = state.data;
    if (viewer.kind === "host") return { myWord: null, words };
    const myWord = viewer.kind === "player" && isMember ? (words[viewer.playerId] ?? null) : null;
    return { myWord, words: state.revealed ? words : null };
  },
};
