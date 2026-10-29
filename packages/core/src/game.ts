import type { z } from "zod";
import type { Rng } from "./rng.js";
import type {
  ConfigField,
  GamePhase,
  GameSessionView,
  GroupId,
  GroupSummary,
  PlayerId,
  TimerState,
  Viewer,
} from "./types.js";

/**
 * Game Module Contract (PRD §7) — server-side half.
 *
 * Core owns lobby, groups, the shared turn rotation and the server timer (PRD §6.5).
 * A module owns its rules, its per-group `data`, and optional session-wide shared state.
 * It MUST filter data per viewer in viewFor() and sharedViewFor(). Core never sends
 * module state to a client without its corresponding view filter.
 *
 * The client-side half (React components) lives in the package's `./views` entry and
 * is typed in @cangsplayground/ui (GameViews).
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
  eliminated: PlayerId[];
  turnIndex: number;
  timer: TimerState;
  revealed: boolean;
  data: Data;
}

export interface GameAction {
  type: string;
  payload?: unknown;
}

export interface RosterEntry {
  playerId: PlayerId;
  groupId: GroupId | null;
  connected: boolean;
}

export interface SharedArgs<Config, Shared> {
  config: Config;
  shared: Shared;
  roster: RosterEntry[];
  now: number;
  rng: Rng;
}

/** A shared-state wake-up the server schedules on the module's behalf. */
export interface SharedDeadline {
  /** Unique among the deadlines exported at one time; encode every version it depends on. */
  key: string;
  /** Epoch ms, server clock. */
  endsAt: number;
}

export interface ActionResult<Data> {
  data?: Data;
  /** Ask core to advance to the next speaker. */
  endTurn?: boolean;
  closeVote?: boolean;
}

export interface LeaveOutcome<Data> {
  data: Data;
  finished?: boolean;
  closeVote?: boolean;
}

export interface VoteOutcome<Data> {
  data: Data;
  eliminate?: PlayerId[];
  finished?: boolean;
}

export function activePlayers(state: Pick<GroupRuntime, "turnOrder">): PlayerId[] {
  return [...new Set(state.turnOrder)];
}

export interface GameModule<Config = any, Data = any, Shared = any> {
  id: string;
  name: string;
  description: string;
  /** Core validates group plans against this (GRP-10, edge case "too few players"). */
  minPlayersPerGroup: number;
  maxPlayersPerGroup?: number;
  /** Shown on the game card, e.g. "3–6 per group". */
  recommended: string;
  /** Controls with no effect for this game; omitted means all are supported. */
  unsupportedControls?: GameSessionView["unsupportedControls"];

  /** Zod schema for the config; core parses game:configure payloads with it. */
  configSchema: z.ZodType<Config>;
  defaultConfig: Config;
  /** Form description for the Host Console (core renders it). */
  configFields: ConfigField[];

  /** Length of one speaking turn in ms; null = the game does not use the shared turn timer. */
  turnDurationMs(config: Config): number | null;
  /** How many times each member speaks per round (default 1). */
  turnsPerPlayer?(config: Config): number;
  voteDurationMs?(config: Config): number | null;
  gameDurationMs?(config: Config): number | null;
  onGameTimeUp?(args: { config: Config; state: GroupRuntime<Data> }): Data;
  onVoteEnd?(args: { config: Config; state: GroupRuntime<Data> }): VoteOutcome<Data>;

  resolveConfig?(args: { config: Config; rng: Rng }): Config;
  validateGroup?(args: { config: Config; group: GroupSummary }): string | null;
  validateGroups?(args: { config: Config; groups: GroupSummary[] }): string | null;

  /** Deal roles / info for one group. Called on "prepare" and on every "nextRound". */
  prepare(args: { config: Config; group: GroupContext; rng: Rng }): Data;

  prepareShared?(args: { config: Config; groups: GroupContext[]; rng: Rng; now: number }): Shared;

  /** Player game:action (except turn:done) and host game:hostAction. Return null to reject. */
  onSharedAction?(
    args: SharedArgs<Config, Shared> & {
      action: GameAction;
      actor: Viewer;
    },
  ): Shared | null;
  onSharedPlayerLeft?(
    args: SharedArgs<Config, Shared> & {
      playerId: PlayerId;
      groupId: GroupId | null;
    },
  ): Shared;
  /** A player connected or disconnected (roster.connected changed). */
  onSharedRosterChange?(args: SharedArgs<Config, Shared>): Shared;
  /**
   * Optional: deadlines the server must wake the module for, so timed shared state
   * advances with no client online. Recomputed after every change.
   */
  sharedDeadlines?(args: SharedArgs<Config, Shared>): SharedDeadline[];
  /**
   * A deadline exported by sharedDeadlines() is due. Core has already checked that it is
   * still exported unchanged. Return null (or the same reference) for no change.
   */
  onSharedDeadline?(
    args: SharedArgs<Config, Shared> & {
      deadline: SharedDeadline;
    },
  ): Shared | null;
  /**
   * REQUIRED when prepareShared is declared: filter shared state for this viewer (PRD §7).
   * Called only while ACTIVE with non-null prepared shared state.
   */
  sharedViewFor?(args: {
    config: Config;
    shared: Shared;
    viewer: Viewer;
    viewerGroupId: GroupId | null;
  }): unknown;

  onContinue?(args: { config: Config; state: GroupRuntime<Data>; rng: Rng }): Data;
  onPlayerLeft?(args: {
    config: Config;
    state: GroupRuntime<Data>;
    playerId: PlayerId;
  }): LeaveOutcome<Data>;

  /** Player action (game:action). Return null to reject it. `turn:done` is handled by core. */
  onAction?(args: {
    config: Config;
    state: GroupRuntime<Data>;
    action: GameAction;
    actor: Viewer;
    rng: Rng;
  }): ActionResult<Data> | null;

  /** Called before the turn index moves; on expiry, follows the legacy onTimerEnd hook. */
  onTurnEnd?(args: {
    config: Config;
    state: GroupRuntime<Data>;
    reason: "timer" | "done" | "skip";
  }): Data;

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
