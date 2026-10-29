import type { LobbyView } from "@cangsplayground/core";
import { Mic, Pause, Trophy } from "lucide-react";
import { Chip, Timer, type SessionViewProps } from "@cangsplayground/ui";
import type { GuessView, MatchPublicView } from "../types.js";
import {
  Person,
  Versus,
  categoryName,
  guessView,
  matchLabel,
  pauseText,
  phaseLabels,
  resultText,
} from "./shared.js";

function ProjectorMatch({
  lobby,
  view,
  match,
  serverNow,
}: {
  lobby: LobbyView;
  view: GuessView;
  match: MatchPublicView;
  serverNow: () => number;
}) {
  const live = match.phase === "CATEGORY_VOTE" || match.phase === "PLAYING";
  return (
    <section className={`cp-panel gc-pmatch gc-match-${match.phase.toLowerCase()}`}>
      <header className="gc-match-head">
        <h2>{matchLabel(match)}</h2>
        <Chip active={live && !match.paused}>
          {match.paused ? "Paused" : phaseLabels[match.phase]}
        </Chip>
      </header>
      <Versus lobby={lobby} groupIds={match.groupIds} />
      {match.phase === "CATEGORY_VOTE" && (
        <p className="gc-pline">
          Voting: <strong>{match.votedCount}</strong> of {match.voterCount}
        </p>
      )}
      {(match.phase === "PLAYING" || match.phase === "FINISHED" || match.phase === "ENDED") &&
        match.categoryId && (
          <p className="gc-pline">
            <span className="cp-muted">Category</span>{" "}
            <strong>{categoryName(view, match.categoryId)}</strong>
          </p>
        )}
      {match.phase === "PLAYING" && (
        <p className="gc-pline gc-pspeaker">
          <Mic strokeWidth={2.25} aria-hidden="true" />
          <Person lobby={lobby} id={match.speakerId} size={36} />
        </p>
      )}
      {match.paused && (
        <p className="gc-paused">
          <Pause strokeWidth={2.25} aria-hidden="true" /> {pauseText(match)}
        </p>
      )}
      {live && <Timer timer={match.timer} serverNow={serverNow} className="gc-ptimer" />}
      {(match.phase === "FINISHED" || match.phase === "ENDED") && (
        <p className="gc-presult">
          {match.phase === "FINISHED" && <Trophy strokeWidth={2.25} aria-hidden="true" />}
          {resultText(lobby, match)}
        </p>
      )}
      {match.phase === "READY" && <p className="cp-muted gc-pline">Waiting for the teacher</p>}
    </section>
  );
}

/** Public grid only: no characters, no guesses. */
export function ProjectorScreen({ lobby, session, serverNow }: SessionViewProps) {
  const view = guessView(session);
  if (!view) return null;
  return (
    <section className="gc-projector">
      <h2 className="gc-projector-title">Round {view.round}</h2>
      <div className={`gc-projector-grid ${view.matches.length > 4 ? "gc-projector-dense" : ""}`}>
        {view.matches.map((match) => (
          <ProjectorMatch
            key={match.id}
            lobby={lobby}
            view={view}
            match={match}
            serverNow={serverNow}
          />
        ))}
      </div>
    </section>
  );
}

/** Fills the projector's public banner with the one rule everyone needs. */
export function ProjectorHeader() {
  return (
    <p className="gc-projector-rule">
      Ask questions in English. Guess the other team's secret character first!
    </p>
  );
}
