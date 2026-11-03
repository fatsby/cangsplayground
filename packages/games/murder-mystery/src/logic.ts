import type { GameModule } from "@cangsplayground/core";
import { reduceAction } from "./actions.js";
import { deadlines, expireDeadline } from "./clock.js";
import { LIMITS, configSchema, type MurderConfig } from "./config.js";
import { handlePlayerLeft, handleRosterChange } from "./lifecycle.js";
import { prepareCase, validateTeams } from "./round.js";
import { GAME_ID, type MurderShared } from "./types.js";
import { viewFor } from "./view.js";

const timeField = (key: keyof MurderConfig, label: string, help: string) => ({
  key,
  label,
  kind: "number" as const,
  display: "stepper" as const,
  ...LIMITS,
  unit: "sec",
  help,
});

/**
 * The cooperative murder-mystery minigame as a shared-state game module.
 *
 * One server-generated case is played by every team at the same time on a class-wide clock;
 * each team keeps its own investigation history. Legacy per-group hooks are inert, and the
 * generic pause/skip/reveal controls are suppressed because the session panel owns them.
 */
export const murderMystery: GameModule<MurderConfig, null, MurderShared> = {
  id: GAME_ID,
  name: "Murder Mystery",
  description:
    "Teams share private clues in English, choose four investigations and explain one accusation.",
  minPlayersPerGroup: 3,
  maxPlayersPerGroup: 4,
  recommended: "3-4 players per team, any number of teams",
  unsupportedControls: ["pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"],
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    timeField("briefingSeconds", "Case briefing time", "Teams read the public case file."),
    timeField("sharingSeconds", "Clue sharing time", "Each player reads their own clue aloud."),
    timeField("investigationSeconds", "Time per investigation", "Four investigations are played."),
    timeField("conclusionSeconds", "Accusation time", "Teams agree and confirm one accusation."),
  ],
  turnDurationMs: () => null,
  prepare: () => null,
  publicInfo: () => ({}),
  viewFor: () => null,
  validateGroups: ({ groups }) =>
    validateTeams(groups.map((g) => ({ groupId: g.id, playerIds: g.playerIds }))),
  prepareShared: ({ groups, rng }) => prepareCase(groups, 1, rng),
  onSharedAction: ({ shared, action, actor, ...ctx }) => reduceAction(shared, ctx, actor, action),
  sharedDeadlines: ({ shared }) => deadlines(shared),
  onSharedDeadline: ({ shared, deadline, config, now }) =>
    expireDeadline(shared, deadline, config, now),
  onSharedPlayerLeft: handlePlayerLeft,
  onSharedRosterChange: handleRosterChange,
  sharedViewFor: viewFor,
};
