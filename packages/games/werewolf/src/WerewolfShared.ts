import type { PlayerId, SharedDeadline } from "@cangsplayground/core";
import type { PlayerState } from "./PlayerState.js";
import type { Stage, Team } from "./types.js";

/**
 * The whole server-side game state. Never sent to clients as is: `view.ts` filters it per viewer.
 * `deadline` is the single timer the lobby wakes the module for; its key is `${stage}:${night}`.
 */
export interface WerewolfShared {
  stage: Stage;
  /** 1-based night counter; 0 before the first night. Day N follows night N. */
  night: number;
  deadline: SharedDeadline | null;
  /** Length in ms of the stage the deadline belongs to (for timer rings), or null when nothing is timed. */
  stageMs: number | null;
  players: Record<PlayerId, PlayerState>;
  /** Join order, for stable display. */
  order: PlayerId[];
  /** Werewolf id -> chosen victim, for the current night. */
  wolfVotes: Record<PlayerId, PlayerId>;
  /** Seer id -> their locked pick for the current night (the host may assign several Seers). */
  seerPicks: Record<PlayerId, PlayerId>;
  /** Guard id -> who they protect tonight (the host may assign several Guards). */
  guardPicks: Record<PlayerId, PlayerId>;
  /** Guards who have already spent their single self-protection (recorded when a night resolves). */
  guardSelfUsed: PlayerId[];
  /** Every inspection so far; a Seer only ever sees their own entries. */
  seerLog: Array<{ seerId: PlayerId; night: number; targetId: PlayerId; isWerewolf: boolean }>;
  /** Result of the last night: who died, or null for "no one died". */
  dawn: { eliminatedId: PlayerId | null } | null;
  /** Voter id -> target id for the current day vote. */
  dayVotes: Record<PlayerId, PlayerId>;
  lastVote: { eliminatedId: PlayerId | null; counts: Record<PlayerId, number> } | null;
  /** Set only on entering ENDED. */
  winner: Team | null;
  /** Computed when a night or vote resolves; hidden from every viewer until ENDED. */
  pendingWinner: Team | null;
}
