import type { GameModule } from "@clubplay/core";
import { GAME_ID, configSchema, type FreeTalkConfig, type FreeTalkData } from "./types.js";

export const freeTalk: GameModule<FreeTalkConfig, FreeTalkData> = {
  id: GAME_ID,
  name: "Free Talk Timer",
  description: "Talk about a topic. Take turns in your group.",
  minPlayersPerGroup: 2,
  recommended: "3–8 per group",
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    { key: "prompt", label: "Topic or question", kind: "textarea" },
    {
      key: "turnSeconds",
      label: "Time for each turn",
      kind: "number",
      min: 15,
      max: 300,
      step: 15,
      unit: "sec",
    },
    {
      key: "turnsPerPlayer",
      label: "Turns for each player",
      kind: "number",
      min: 1,
      max: 3,
      step: 1,
    },
  ],
  turnDurationMs: (config) => config.turnSeconds * 1000,
  turnsPerPlayer: (config) => config.turnsPerPlayer,
  prepare: () => ({ spoken: [] }),
  onTimerEnd: ({ state }) => {
    const speaker = state.turnOrder[state.turnIndex];
    return { spoken: speaker ? [...state.data.spoken, speaker] : [...state.data.spoken] };
  },
  publicInfo: (config) => ({ prompt: config.prompt, turnSeconds: config.turnSeconds }),
  viewFor: ({ state }) => ({ spoken: [...state.data.spoken] }),
};
export default freeTalk;
