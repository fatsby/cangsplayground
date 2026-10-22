/**
 * Shared domain + wire types. Everything a client receives is a *view* (LobbyView),
 * already filtered for that viewer on the server (PRD §7, §10). Raw server state
 * (tokens, other players' secrets) never appears in these types.
 */

import type { C2SPayload } from "./events.js";

export type PlayerId = string;
export type GroupId = string;

export const MAX_PLAYERS_PER_LOBBY = 60; // LOB-08
export const PLAYER_NAME_MAX = 20; // JOIN-02
export const LOBBY_TTL_MINUTES_DEFAULT = 180; // LOB-07
export const AWAY_AFTER_MS = 5 * 60_000; // NFR-05
export const EXTEND_MS = 30_000; // TMR-04 "+30s"

export type Viewer =
  { kind: "projector" } | { kind: "host" } | { kind: "player"; playerId: PlayerId };

export type ViewerKind = Viewer["kind"];

/** GAME-03 lifecycle of one group's game. */
export type GamePhase = "PREPARED" | "RUNNING" | "PAUSED" | "ROUND_END" | "VOTING" | "FINISHED";

/**
 * Server-authoritative timer (TMR-01). Exactly one of these holds:
 * - running: endsAt set (epoch ms, server clock), pausedRemainingMs null
 * - paused:  endsAt null, pausedRemainingMs set
 * - idle:    both null
 */
export interface TimerState {
  endsAt: number | null;
  pausedRemainingMs: number | null;
  /** Full length of the current turn, for progress rings. */
  durationMs: number;
}

export interface PlayerSummary {
  id: PlayerId;
  name: string;
  groupId: GroupId | null; // null = "No group yet" (JOIN-05)
  connected: boolean;
  away: boolean; // offline > 5 min (NFR-05)
}

export interface GroupSummary {
  id: GroupId;
  /** 0-based team palette index → teamStyle(index) for colour/shape/name. */
  index: number;
  name: string; // "Team Red"
  playerIds: PlayerId[];
}

/** One form field on the Host Console, rendered by core UI (GAME-02). */
export interface ConfigField {
  key: string;
  label: string;
  kind: "number" | "text" | "textarea" | "boolean" | "select";
  display?: "chips" | "stepper";
  min?: number;
  max?: number;
  step?: number;
  unit?: string; // "sec"
  options?: { value: string; label: string }[];
  help?: string;
  showWhen?: { key: string; equals: string };
}

/** GAME-01 card on the Host Console. */
export interface GameCatalogEntry {
  id: string;
  name: string;
  description: string;
  minPlayersPerGroup: number;
  maxPlayersPerGroup?: number;
  /** e.g. "3–6 per group" */
  recommended: string;
  configFields: ConfigField[];
  defaultConfig: Record<string, unknown>;
}

export interface GroupGameView {
  eliminated: PlayerId[];
  groupId: GroupId;
  phase: GamePhase;
  round: number; // 1-based
  /** Public: who is speaking now / next (TMR-02). */
  currentSpeakerId: PlayerId | null;
  nextSpeakerId: PlayerId | null;
  /** `group` tier: full speaking order — group members + host only; null for others. */
  turnOrder: PlayerId[] | null;
  turnIndex: number;
  turnCount: number;
  timer: TimerState;
  revealed: boolean;
  /** Game module's viewFor() output for this viewer. Shape is defined by the game package. */
  data: unknown;
}

export interface GameClockView {
  timer: TimerState;
  done: boolean;
}

export interface GameSessionView {
  voteDurationMs?: number | null;
  clock: GameClockView | null;
  gameId: string;
  name: string;
  /** Omitted means all controls are supported. Core lifecycle controls are always supported. */
  unsupportedControls?: readonly Exclude<
    C2SPayload<"game:control">["cmd"],
    "prepare" | "start" | "exit"
  >[];
  /** "CONFIGURING" until the host presses Prepare; then per-group phases apply. */
  stage: "CONFIGURING" | "ACTIVE";
  /** Full config — host only. null for projector/player. */
  config: Record<string, unknown> | null;
  /** Public-tier session info from module.publicInfo(config), e.g. the Free Talk prompt. */
  publicInfo: unknown;
  /** Projector + host: every group. Player: only their own group (or empty). */
  groups: GroupGameView[];
}

export interface HostWarning {
  code: "PLAYER_LEFT_MID_ROUND" | "GROUPS_TOO_SMALL" | "UNASSIGNED_PLAYERS";
  message: string;
  groupId?: GroupId;
  playerId?: PlayerId;
}

export interface LobbyView {
  viewer: Viewer;
  code: string;
  status: "open" | "closed";
  locked: boolean;
  /** True while a Host Console socket is attached — projector hides the pairing QR. */
  hostConnected: boolean;
  createdAt: number;
  maxPlayers: number;
  /** Names are public (projector shows the join list, JOIN-06). */
  players: PlayerSummary[];
  groups: GroupSummary[];
  /** Increments on every groups:assign — clients can replay the shuffle animation (GRP-07). */
  groupsVersion: number;
  game: GameSessionView | null;
  /** Host only (empty for others). */
  catalog: GameCatalogEntry[];
  /** Player only. */
  me: { playerId: PlayerId; name: string; groupId: GroupId | null } | null;
  /** Host only. */
  warnings: HostWarning[];
  /** Server-side monotonic version of this lobby's state. */
  version: number;
}
