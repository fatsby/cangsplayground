import { dealRoles } from "./rules.js";
import type { GameModule } from "@cangsplayground/core";
import type { Reducer } from "./context.js";
import { advance } from "./flow.js";
import { dayActions } from "./day.js";
import { nightActions } from "./night.js";
import { playerJoined, playerLeft } from "./roster.js";
import { viewForViewer } from "./view.js";
import { initialShared, setupActions } from "./setup.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import { GAME_ID, MIN_PLAYERS, configSchema, type WerewolfConfig } from "./types.js";

/** Every player/host action the module understands, keyed by action type. */
const ACTIONS: Record<string, Reducer> = { ...setupActions, ...nightActions, ...dayActions };

const durationField = (key: keyof WerewolfConfig, label: string, min: number, max: number, step: number) =>
  ({ key, label, kind: "number", display: "stepper", min, max, step, unit: "sec" }) as const;

/**
 * Werewolf: an app-moderated social-deduction game for the whole lobby.
 * The host never plays; the module runs the night, dawn, discussion and vote itself and the
 * lobby wakes it through shared deadlines. State lives in `WerewolfShared` (see its doc).
 */
const werewolf: GameModule<WerewolfConfig, null, WerewolfShared> = {
  id: GAME_ID,
  name: "Werewolf",
  description: "Hunt or protect the village. The app narrates every night and day.",
  minPlayersPerGroup: MIN_PLAYERS,
  wholeLobby: true,
  recommended: "5+ players, whole class",
  unsupportedControls: ["pause", "resume", "skip", "extend", "endRound", "reveal", "nextRound"],
  configSchema,
  defaultConfig: configSchema.parse({}),
  configFields: [
    durationField("nightSeconds", "Night length", 10, 120, 5),
    durationField("discussionSeconds", "Discussion length", 30, 600, 15),
    durationField("voteSeconds", "Vote length", 15, 180, 5),
  ],
  turnDurationMs: () => null,
  prepare: () => null,
  publicInfo: () => ({}),
  viewFor: () => null,
  sharedViewFor: ({ shared, viewer }) => viewForViewer(shared, viewer),
  prepareShared({ groups, rng }) {
    const playerIds = groups.flatMap((g) => g.playerIds);
    return initialShared(playerIds, dealRoles(playerIds, rng));
  },
  sharedDeadlines: ({ shared }) => (shared.deadline ? [shared.deadline] : []),
  onSharedDeadline({ shared, deadline, ...ctx }) {
    if (shared.deadline?.key !== deadline.key) return null;
    return advance(structuredClone(shared), ctx);
  },
  onSharedPlayerJoined: ({ shared, playerId }) => playerJoined(structuredClone(shared), playerId),
  onSharedPlayerLeft: ({ shared, playerId }) => playerLeft(structuredClone(shared), playerId),
  // Disconnected players keep their seat; they just skip whatever they were due to do.
  onSharedRosterChange: ({ shared }) => shared,
  onSharedAction({ shared, action, ...ctx }) {
    if (!Object.hasOwn(ACTIONS, action.type)) return null;
    return ACTIONS[action.type]!(structuredClone(shared), ctx, action.payload);
  },
};

export default werewolf;
