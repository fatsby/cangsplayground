import type { GameVoteView } from "@cangsplayground/core";
import { Timer } from "@cangsplayground/ui";
import { GameVoteBars } from "./GameVoteBars";
import { GameVoteWinner } from "./GameVoteWinner";

/**
 * Projector screen for the minigame vote: countdown and live bars, then the announced winner.
 * The turnout sits in the heading row so a full ballot of every game still fits a 4:3 projector.
 */
export function ProjectorGameVote({
  vote,
  serverNow,
}: {
  vote: GameVoteView;
  serverNow: () => number;
}) {
  const open = vote.status === "OPEN";
  const turnout = (
    <p className="cp-muted gv-projector-count">
      {vote.votedCount} of {vote.eligibleCount} voted
    </p>
  );
  return (
    <section className="gv-projector">
      <div className="gv-projector-head">
        {open ? (
          <div>
            <h2>Vote for the next game</h2>
            {turnout}
          </div>
        ) : (
          <GameVoteWinner vote={vote} large />
        )}
        {open ? <Timer timer={vote.timer} serverNow={serverNow} ring /> : turnout}
      </div>
      <GameVoteBars vote={vote} large />
    </section>
  );
}
