import type { GameVoteView } from "@cangsplayground/core";

/**
 * The announcement shown once a minigame vote has closed. A vote nobody took part in has no
 * winner, and says so instead of naming a game nobody picked.
 */
export function GameVoteWinner({ vote, large = false }: { vote: GameVoteView; large?: boolean }) {
  const winner = vote.options.find((option) => option.gameId === vote.winnerId);
  return (
    <div className={`gv-winner ${large ? "gv-winner-large" : ""}`} role="status">
      <p className="eyebrow">{winner ? "The room picked" : "No votes"}</p>
      <h2>{winner?.name ?? "Nobody voted"}</h2>
      {winner && (
        <p className="cp-muted">
          {winner.votes} {winner.votes === 1 ? "vote" : "votes"}
        </p>
      )}
    </div>
  );
}
