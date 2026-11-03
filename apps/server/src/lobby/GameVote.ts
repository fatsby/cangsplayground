import type { GameVoteView, Rng } from "@cangsplayground/core";
import { fail } from "../auth/errors.js";
import type { GameVoteViewArgs } from "./GameVoteViewArgs.js";

/**
 * One lobby-level "which minigame next?" vote.
 *
 * Rules:
 * - Each player holds at most one ballot and may replace it until the deadline.
 * - Votes are counted live; nothing is hidden until the end.
 * - When time is up, the game with the most votes wins. Ties are broken by the lobby's seeded
 *   RNG so a replayed session picks the same game. If nobody voted there is no winner, since
 *   announcing a game nobody asked for would mislead the room.
 * - The vote never starts a game; it only reports the winner.
 *
 * This class owns no clock and no registry: the lobby tells it when time is up and how to name
 * games, which keeps it deterministic and easy to test.
 */
export class GameVote {
  readonly endsAt: number;
  private readonly ballots = new Map<string, string>();
  private winner: string | null = null;
  private closed = false;

  /**
   * @param optionIds games on the ballot, already de-duplicated and validated by the caller
   * @param startedAt server time the vote opened, epoch ms
   * @param durationMs how long the vote stays open
   */
  constructor(
    readonly optionIds: readonly string[],
    startedAt: number,
    private readonly durationMs: number,
  ) {
    this.endsAt = startedAt + durationMs;
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  /** True once the deadline has been reached, whether or not {@link close} has run yet. */
  isDue(now: number): boolean {
    return now >= this.endsAt;
  }

  /**
   * Records or replaces a player's ballot.
   *
   * @throws CommandError `INVALID_STATE` when the vote is already closed, `NOT_FOUND` when the
   *   game is not on the ballot
   */
  cast(playerId: string, gameId: string): void {
    if (this.closed) fail("INVALID_STATE", "Voting has ended.");
    if (!this.optionIds.includes(gameId)) fail("NOT_FOUND", "That game is not in this vote.");
    this.ballots.set(playerId, gameId);
  }

  /** Withdraws a leaving player's ballot. Has no effect once the result is announced. */
  forget(playerId: string): void {
    if (!this.closed) this.ballots.delete(playerId);
  }

  /** Freezes the tally and picks the winner. Calling it again changes nothing. */
  close(rng: Rng): void {
    if (this.closed) return;
    this.closed = true;
    const counts = this.counts();
    const top = Math.max(...counts.values());
    if (top === 0) return;
    const leaders = this.optionIds.filter((id) => counts.get(id) === top);
    this.winner = leaders[rng.int(leaders.length)]!;
  }

  view({ viewerPlayerId, eligibleCount, nameOf }: GameVoteViewArgs): GameVoteView {
    const counts = this.counts();
    return {
      status: this.closed ? "CLOSED" : "OPEN",
      options: this.optionIds.map((gameId) => ({
        gameId,
        name: nameOf(gameId),
        votes: counts.get(gameId)!,
      })),
      timer: {
        endsAt: this.closed ? null : this.endsAt,
        pausedRemainingMs: null,
        durationMs: this.durationMs,
      },
      votedCount: this.ballots.size,
      eligibleCount,
      winnerId: this.winner,
      myVote: viewerPlayerId === null ? null : (this.ballots.get(viewerPlayerId) ?? null),
    };
  }

  private counts(): Map<string, number> {
    const counts = new Map(this.optionIds.map((id) => [id, 0]));
    for (const gameId of this.ballots.values()) counts.set(gameId, counts.get(gameId)! + 1);
    return counts;
  }
}
