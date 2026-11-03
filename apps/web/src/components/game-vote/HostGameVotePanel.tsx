import { useState } from "react";
import {
  GAME_VOTE_DURATION_MS,
  GAME_VOTE_MIN_OPTIONS,
  type LobbyView,
} from "@cangsplayground/core";
import { Button, Panel, Switch, Timer } from "@cangsplayground/ui";
import { GameVoteBars } from "./GameVoteBars";
import { GameVoteWinner } from "./GameVoteWinner";

/**
 * Host controls for the minigame vote.
 *
 * Setup lists every game with a switch (all on by default) and opens the vote. While it runs the
 * host sees the live tally and can cancel; afterwards the winner is shown and one tap returns to
 * setup. The vote only reports a winner; the host still chooses and starts the game.
 */
export function HostGameVotePanel({
  view,
  busy,
  serverNow,
  onStart,
  onClear,
}: {
  view: LobbyView;
  busy: boolean;
  serverNow: () => number;
  onStart: (gameIds: string[]) => void;
  onClear: () => void;
}) {
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const vote = view.gameVote;
  if (vote) {
    const open = vote.status === "OPEN";
    return (
      <Panel className="cp-stack gv-host">
        <div className="cp-row cp-spread">
          <h2>{open ? "Vote is open" : "Vote finished"}</h2>
          {open && <Timer timer={vote.timer} serverNow={serverNow} />}
        </div>
        {!open && <GameVoteWinner vote={vote} />}
        <GameVoteBars vote={vote} />
        <p className="cp-muted">
          {vote.votedCount} of {vote.eligibleCount} voted
        </p>
        <Button disabled={busy} onClick={onClear}>
          {open ? "Cancel vote" : "Back to vote setup"}
        </Button>
      </Panel>
    );
  }
  const chosen = view.catalog.filter((game) => !excluded.has(game.id));
  const toggle = (id: string, on: boolean) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Panel className="cp-stack gv-host">
      <h2>Let players vote</h2>
      <p className="cp-muted">
        Pick the games on the ballot. Players get {GAME_VOTE_DURATION_MS / 1000} seconds to choose.
      </p>
      {view.catalog.map((game) => (
        <Switch
          key={game.id}
          label={game.name}
          checked={!excluded.has(game.id)}
          disabled={busy}
          onCheckedChange={(on) => toggle(game.id, on)}
        />
      ))}
      <Button
        variant="primary"
        disabled={busy || chosen.length < GAME_VOTE_MIN_OPTIONS || view.players.length === 0}
        onClick={() => onStart(chosen.map((game) => game.id))}
      >
        Start vote ({GAME_VOTE_DURATION_MS / 1000}s)
      </Button>
      {chosen.length < GAME_VOTE_MIN_OPTIONS && (
        <p className="cp-muted">Pick at least {GAME_VOTE_MIN_OPTIONS} games.</p>
      )}
      {view.players.length === 0 && <p className="cp-muted">Wait for players to join.</p>}
    </Panel>
  );
}
