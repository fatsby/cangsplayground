import type { PlayerId } from "@cangsplayground/core";
import type { Role } from "./types.js";

/** What one player may know about themselves. Fields that do not apply to their role are null. */
export interface MyState {
  /** Null while a late joiner is still waiting to enter play. A dead player still sees their own role. */
  role: Role | null;
  alive: boolean;
  pending: boolean;
  /** Fellow werewolves (living or not), only for a werewolf. */
  teammates: PlayerId[];
  /** The whole pack's votes tonight, only for a werewolf during NIGHT. */
  wolfVotes: Record<PlayerId, PlayerId> | null;
  /** Past inspections, only for the Seer. */
  seerLog: Array<{ night: number; targetId: PlayerId; isWerewolf: boolean }> | null;
  /** Only for the Guard. */
  guardSelfUsed: boolean | null;
  myVote: PlayerId | null;
  /** The target this player chose tonight (wolf vote, seer pick or guard pick), during NIGHT only. */
  myNightPick: PlayerId | null;
}
