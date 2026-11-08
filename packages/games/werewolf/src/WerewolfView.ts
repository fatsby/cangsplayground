import type { PlayerId } from "@cangsplayground/core";
import type { MyState } from "./MyState.js";
import type { Role, Stage, Team } from "./types.js";

/**
 * What a client receives. Built per viewer by `viewForViewer`; every secret is null for viewers who
 * may not see it. The projector and players never get `roles` before ENDED, and nobody but the host
 * ever gets `hostNight` or `hostVotes`.
 */
export interface WerewolfView {
  stage: Stage;
  night: number;
  /** Epoch ms (server clock) when the current stage ends, or null. */
  deadlineAt: number | null;
  players: Array<{ id: PlayerId; alive: boolean; pending?: true }>;
  /** Host: always. Everyone else: only once the game has ENDED. */
  roles: Record<PlayerId, Role> | null;
  me: MyState | null;
  dawn: { eliminatedId: PlayerId | null } | null;
  /** Public vote totals during VOTE. */
  voteCounts: Record<PlayerId, number>;
  /** Votes needed to banish someone right now (half of the living players, rounded up). */
  needed: number;
  /** Public totals and result, during VERDICT only. */
  lastVote: { eliminatedId: PlayerId | null; counts: Record<PlayerId, number> } | null;
  /** Null until the game has ENDED. */
  winner: Team | null;
  hostNight: {
    wolfVotes: Record<PlayerId, PlayerId>;
    seerPick: PlayerId | null;
    guardPick: PlayerId | null;
  } | null;
  hostVotes: Record<PlayerId, PlayerId> | null;
}
