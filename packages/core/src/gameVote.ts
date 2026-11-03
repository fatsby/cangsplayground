import type { GameVoteOptionView } from "./gameVoteOption.js";
import type { TimerState } from "./types.js";

/** How long players have to pick a minigame once the host opens the vote. */
export const GAME_VOTE_DURATION_MS = 60_000;

/** A ballot needs at least two games, otherwise there is nothing to choose. */
export const GAME_VOTE_MIN_OPTIONS = 2;

/**
 * Lobby-level "which minigame next?" vote, distinct from the per-group voting phase that
 * individual games run. The vote only reports a winner; the host still picks the game.
 */
export interface GameVoteView {
  /** OPEN while the countdown runs, CLOSED once the winner is announced. */
  status: "OPEN" | "CLOSED";
  options: GameVoteOptionView[];
  /** Server-authoritative countdown; `endsAt` is null once CLOSED. */
  timer: TimerState;
  /** Players who currently hold a vote. */
  votedCount: number;
  /** Players in the lobby, i.e. the most votes that can exist. */
  eligibleCount: number;
  /** Winning game once CLOSED; null while OPEN or when nobody voted. */
  winnerId: string | null;
  /** The viewing player's current choice; always null for host and projector. */
  myVote: string | null;
}
