import type { GameVoteView } from "@cangsplayground/core";
import { Panel, Timer } from "@cangsplayground/ui";
import { GameVoteWinner } from "./GameVoteWinner";

/**
 * A player's minigame ballot: tap a game to vote, tap another to change. Counts update live.
 *
 * Once the vote closes the buttons lock and the screen shows what the room picked; the host
 * decides whether to play it.
 */
export function GameVoteBallot({
  vote,
  serverNow,
  disabled,
  onCast,
}: {
  vote: GameVoteView;
  serverNow: () => number;
  /** True while a tap is in flight or the connection is down. */
  disabled: boolean;
  onCast: (gameId: string) => void;
}) {
  const open = vote.status === "OPEN";
  return (
    <section className="gv-ballot cp-stack">
      <div className="cp-row cp-spread">
        <h1>{open ? "Vote for the next game" : "Voting is over"}</h1>
        {open && <Timer timer={vote.timer} serverNow={serverNow} />}
      </div>
      {!open && (
        <Panel className="cp-stack">
          <GameVoteWinner vote={vote} />
          <p className="cp-muted">Wait for your teacher</p>
        </Panel>
      )}
      <ul className="gv-choices">
        {vote.options.map((option) => (
          <li key={option.gameId}>
            <button
              type="button"
              className={`gv-choice ${vote.myVote === option.gameId ? "gv-choice-mine" : ""} ${vote.winnerId === option.gameId ? "gv-choice-winner" : ""}`}
              aria-pressed={vote.myVote === option.gameId}
              disabled={disabled || !open}
              onClick={() => onCast(option.gameId)}
            >
              <span className="gv-choice-name">{option.name}</span>
              <strong className="gv-choice-count">
                {option.votes}
                <span className="cp-sr-only"> {option.votes === 1 ? "vote" : "votes"}</span>
              </strong>
            </button>
          </li>
        ))}
      </ul>
      <p className="cp-muted">
        {vote.votedCount} of {vote.eligibleCount} voted
        {open && vote.myVote === null ? ". Tap a game to vote" : ""}
        {open && vote.myVote !== null ? ". Tap another game to change your vote" : ""}
      </p>
    </section>
  );
}
