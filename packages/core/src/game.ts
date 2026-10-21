import type { z } from "zod";
import type { Rng } from "./rng.js";
import type { ConfigField, GamePhase, GroupId, PlayerId, TimerState, Viewer } from "./types.js";

/**
 * Game Module Contract (PRD §7) — server-side half.
 *
 * Core owns lobby, groups, the shared turn rotation and the server timer (PRD §6.5).
 * A module owns only its rules and its per-group `data`, and MUST filter that data
 * per viewer in viewFor(). Core never sends `data` to a client without viewFor().
 *
 * The client-side half (React components) lives in the package's `./views` entry and
 * is typed in @clubplay/ui (GameViews).
 */

export interface GroupContext {
  groupId: GroupId;
  /** Members in the group's speaking order for this round. */
  playerIds: PlayerId[];
  round: number;
}

/** Core-managed state of one group's game; `data` belongs to the module. */
export interface GroupRuntime<Data = unknown> {
  groupId: GroupId;
  phase: GamePhase;
  round: number;
  turnOrder: PlayerId[];
  turnIndex: number;
  timer: TimerState;
  revealed: boolean;
  data: Data;
}

export interface GameAction {
  type: string;
  payload?: unknown;
}

export interface ActionResult<Data> {
  data?: Data;
  /** Ask core to advance to the next speaker. */
  endTurn?: boolean;
}

export interface GameModule<Config = any, Data = any> {
  id: string;
  name: string;
  description: string;
  /** Core validates group plans against this (GRP-10, edge case "too few players"). */
  minPlayersPerGroup: number;
  maxPlayersPerGroup?: number;
  /** Shown on the game card, e.g. "3–6 per group". */
  recommended: string;

  /** Zod schema for the config; core parses game:configure payloads with it. */
  configSchema: z.ZodType<Config>;
  defaultConfig: Config;
  /** Form description for the Host Console (core renders it). */
  configFields: ConfigField[];

  /** Length of one speaking turn in ms; null = the game does not use the shared turn timer. */
  turnDurationMs(config: Config): number | null;
  /** How many times each member speaks per round (default 1). */
  turnsPerPlayer?(config: Config): number;

  /** Deal roles / info for one group. Called on "prepare" and on every "nextRound". */
  prepare(args: { config: Config; group: GroupContext; rng: Rng }): Data;

  /** Player action (game:action). Return null to reject it. `turn:done` is handled by core. */
  onAction?(args: {
    config: Config;
    state: GroupRuntime<Data>;
    action: GameAction;
    actor: Viewer;
    rng: Rng;
  }): ActionResult<Data> | null;

  /** Called when a speaker's timer runs out, before core advances the turn. */
  onTimerEnd?(args: { config: Config; state: GroupRuntime<Data> }): Data;

  /** Public-tier, session-wide info (safe for the projector), e.g. the shared prompt. */
  publicInfo(config: Config): unknown;

  /**
   * REQUIRED filter (PRD §7). Return only what `viewer` may see of this group's data:
   * projector → public only; player → public + own group + own private; host → everything.
   */
  viewFor(args: {
    config: Config;
    state: GroupRuntime<Data>;
    viewer: Viewer;
    /** True when the viewer is a member of this group. */
    isMember: boolean;
  }): unknown;
}

/** Static catalog row derived from a module (no functions — safe to send to the host). */
export function catalogEntry(m: GameModule) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    minPlayersPerGroup: m.minPlayersPerGroup,
    maxPlayersPerGroup: m.maxPlayersPerGroup,
    recommended: m.recommended,
    configFields: m.configFields,
    defaultConfig: m.defaultConfig as Record<string, unknown>,
  };
}
