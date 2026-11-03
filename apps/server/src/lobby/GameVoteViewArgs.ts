/** Arguments for {@link GameVote.view}. */
export interface GameVoteViewArgs {
  /** The viewing player, or null for host and projector (who never have a personal choice). */
  viewerPlayerId: string | null;
  /** Players in the lobby right now; the most ballots that can exist. */
  eligibleCount: number;
  /** Resolves a game id to the name shown on screen. */
  nameOf: (gameId: string) => string;
}
