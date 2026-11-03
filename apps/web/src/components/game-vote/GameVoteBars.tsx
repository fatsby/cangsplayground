import type { GameVoteView } from "@cangsplayground/core";

/**
 * Read-only live tally for the minigame vote, one bar per game.
 *
 * Bars are scaled against everyone who has voted so far, so they always add up to the full row
 * width. The winner (once announced) is highlighted. Used by the host and the projector.
 */
export function GameVoteBars({ vote, large = false }: { vote: GameVoteView; large?: boolean }) {
  const scale = Math.max(1, vote.votedCount);
  return (
    <ul className={`gv-bars ${large ? "gv-bars-large" : ""}`} aria-label="Vote results">
      {vote.options.map((option) => (
        <li
          key={option.gameId}
          className={`gv-bar ${vote.winnerId === option.gameId ? "gv-bar-winner" : ""}`}
        >
          <span className="gv-bar-name">{option.name}</span>
          <span className="gv-bar-track" aria-hidden="true">
            <span style={{ width: `${(option.votes / scale) * 100}%` }} />
          </span>
          <strong className="gv-bar-count">
            {option.votes}
            <span className="cp-sr-only"> {option.votes === 1 ? "vote" : "votes"}</span>
          </strong>
        </li>
      ))}
    </ul>
  );
}
