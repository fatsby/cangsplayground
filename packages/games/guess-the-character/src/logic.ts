import type { GameModule } from "@cangsplayground/core";
import { CATEGORY_IDS, reduceAction } from "./actions.js";
import { handlePlayerLeft, handleRosterChange } from "./lifecycle.js";
import { deadlines, expireDeadline } from "./match.js";
import { prepareRound, validateGroups } from "./round.js";
import { viewFor } from "./view.js";
import { GAME_ID, LIMITS, configSchema, type GuessConfig, type GuessShared } from "./types.js";

export const guessTheCharacter: GameModule<GuessConfig, null, GuessShared> = {
  id: GAME_ID,
  name: "Guess the Character",
  description: "Two teams ask questions in English to guess each other's secret character.",
  minPlayersPerGroup: 1,
  recommended: "Even number of groups",
  unsupportedControls: ["pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"],
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    {
      key: "voteSeconds",
      label: "Category vote time",
      kind: "number",
      display: "stepper",
      ...LIMITS.voteSeconds,
      unit: "sec",
    },
    {
      key: "turnSeconds",
      label: "Turn time (question + answer)",
      kind: "number",
      display: "stepper",
      ...LIMITS.turnSeconds,
      unit: "sec",
    },
    {
      key: "cooldownSeconds",
      label: "Wrong guess cooldown",
      kind: "number",
      display: "stepper",
      ...LIMITS.cooldownSeconds,
      unit: "sec",
      help: "The whole team waits this long after a wrong guess.",
    },
  ],
  turnDurationMs: () => null,
  prepare: () => null,
  publicInfo: () => ({}),
  viewFor: () => null,
  validateGroups: ({ groups }) =>
    validateGroups(groups.map((g) => ({ groupId: g.id, playerIds: g.playerIds }))),
  prepareShared: ({ groups, rng }) => prepareRound(groups, 1, rng),
  onSharedAction: ({ shared, action, actor, ...ctx }) => reduceAction(shared, ctx, actor, action),
  sharedDeadlines: ({ shared }) => deadlines(shared),
  onSharedDeadline: ({ shared, deadline, ...ctx }) =>
    expireDeadline(shared, deadline, ctx, CATEGORY_IDS),
  onSharedPlayerLeft: handlePlayerLeft,
  onSharedRosterChange: handleRosterChange,
  sharedViewFor: viewFor,
};
