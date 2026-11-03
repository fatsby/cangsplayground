import type { GameVoteView } from "@cangsplayground/core";
import { Timer } from "@cangsplayground/ui";
import { GameVoteBars } from "./GameVoteBars";
import { GameVoteWinner } from "./GameVoteWinner";

/** Projector screen for the minigame vote: countdown and live bars, then the announced winner. */
export function ProjectorGameVote({
  vote,
  serverNow,
}: {
  vote: GameVoteView;
  serverNow: () => number;
}) {
  const open = vote.status === "OPEN";
  return (
    <section className="gv-projector">
      {open ? (
        <div className="gv-projector-head">
          <h2>Vote for the next game</h2>
          <Timer timer={vote.timer} serverNow={serverNow} ring />
        </div>
      ) : (
        <GameVoteWinner vote={vote} large />
      )}
      <GameVoteBars vote={vote} large />
      <p className="cp-muted gv-projector-count">
        {vote.votedCount} of {vote.eligibleCount} voted
      </p>
    </section>
  );
}
