import { dealRoles } from "./rules.js";
import type { GameModule } from "@cangsplayground/core";
import type { Reducer } from "./context.js";
import { initialShared, setupActions } from "./setup.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import { GAME_ID, MIN_PLAYERS, configSchema, type WerewolfConfig } from "./types.js";

/** Every player/host action the module understands, keyed by action type. */
const ACTIONS: Record<string, Reducer> = { ...setupActions };

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
  // Replaced by the real per-viewer filter in the view task; until then nothing is exposed.
  sharedViewFor: () => null,
  prepareShared({ groups, rng }) {
    const playerIds = groups.flatMap((g) => g.playerIds);
    return initialShared(playerIds, dealRoles(playerIds, rng));
  },
  onSharedAction({ shared, action, ...ctx }) {
    if (!Object.hasOwn(ACTIONS, action.type)) return null;
    return ACTIONS[action.type]!(structuredClone(shared), ctx, action.payload);
  },
};

export default werewolf;
