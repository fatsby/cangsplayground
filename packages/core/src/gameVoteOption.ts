/** One minigame on the ballot, with its live tally. */
export interface GameVoteOptionView {
  gameId: string;
  /** Display name; carried here because the catalog is host-only. */
  name: string;
  /** Number of players currently voting for this game. */
  votes: number;
}
