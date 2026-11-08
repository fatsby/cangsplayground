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
  players: Record<PlayerId, PlayerState>;
  /** Join order, for stable display. */
  order: PlayerId[];
  /** Werewolf id -> chosen victim, for the current night. */
  wolfVotes: Record<PlayerId, PlayerId>;
  /** The Seer's locked pick for the current night. */
  seerPick: PlayerId | null;
  guardPick: PlayerId | null;
  /** True once the Guard has spent their single self-protection (set when a night resolves). */
  guardSelfUsed: boolean;
  seerLog: Array<{ night: number; targetId: PlayerId; isWerewolf: boolean }>;
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
