import { useEffect, useState } from "react";
import type { GameSessionView, LobbyView } from "@cangsplayground/core";
import { Mic, Pause, WifiOff } from "lucide-react";
import {
  Button,
  Chip,
  Panel,
  TeamBadge,
  Timer,
  type GameViewProps,
  type SessionViewProps,
} from "@cangsplayground/ui";
import type { ControlGuard, GuessView, MatchPrivateView, MatchPublicView } from "../types.js";
import {
  Person,
  categoryName,
  guessView,
  matchLabel,
  online,
  pauseText,
  phaseLabels,
  resultText,
  teamIndex,
  useServerNow,
} from "./shared.js";

type HostAct = SessionViewProps["hostAct"];
const active = (m: MatchPublicView) => m.phase === "CATEGORY_VOTE" || m.phase === "PLAYING";
const terminal = (m: MatchPublicView) => m.phase === "FINISHED" || m.phase === "ENDED";

function controlGuard(view: GuessView, match: MatchPublicView): ControlGuard {
  return {
    round: view.round,
    matchId: match.id,
    phaseVersion: match.phaseVersion,
    turnId: match.turnId,
  };
}

/** Two-tap confirmation for a destructive button, cancelled after 4 s. */
function useConfirm() {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return [armed, setArmed] as const;
}

function TeamRow({
  lobby,
  match,
  side,
  priv,
  serverNow,
}: {
  lobby: LobbyView;
  match: MatchPublicView;
  side: 0 | 1;
  priv: MatchPrivateView | undefined;
  serverNow: () => number;
}) {
  const groupId = match.groupIds[side];
  const members = match.members[side];
  const character = priv?.characters.find((c) => c.groupId === groupId)?.character;
  const team = priv?.teams.find((t) => t.groupId === groupId);
  const now = useServerNow(serverNow, team?.cooldown.endsAt != null);
  const cooling =
    !!team &&
    ((team.cooldown.endsAt !== null && now < team.cooldown.endsAt) ||
      team.cooldown.pausedRemainingMs !== null);
  const asking = match.askingGroupId === groupId;
  const isOnline = online(lobby, members);
  return (
    <div className={`gc-team ${asking ? "gc-team-asking" : ""}`}>
      <div className="gc-team-head">
        <TeamBadge teamIndex={teamIndex(lobby, groupId)} />
        {match.winnerGroupId === groupId && <Chip active>Winner</Chip>}
        {asking && <Chip>Asking</Chip>}
      </div>
      <p className="gc-character">
        <span className="cp-muted">Character:</span>{" "}
        <strong>
          {character?.name ?? (match.phase === "PLAYING" ? "—" : "Chosen after the vote")}
        </strong>
      </p>
      {cooling && team && (
        <div className="gc-cooldown">
          <span>Wrong guess, waiting</span>
          <Timer timer={team.cooldown} serverNow={serverNow} />
        </div>
      )}
      <ul className="gc-members">
        {members.map((id) => {
          const player = lobby.players.find((p) => p.id === id);
          return (
            <li key={id} className={match.speakerId === id ? "gc-member-speaking" : ""}>
              {match.speakerId === id && (
                <Mic size={18} strokeWidth={2.25} aria-label="Asking now" className="gc-icon" />
              )}
              <Person lobby={lobby} id={id} size={24} />
              {player && !player.connected && (
                <WifiOff size={16} strokeWidth={2.25} aria-label="Offline" className="gc-offline" />
              )}
            </li>
          );
        })}
      </ul>
      {members.length === 0 && <p className="cp-muted gc-small">No players left.</p>}
      {members.length > 0 && isOnline === 0 && (
        <p className="cp-error gc-small">Nobody in this team is online.</p>
      )}
    </div>
  );
}

function VoteTally({ view, priv }: { view: GuessView; priv: MatchPrivateView | undefined }) {
  const counts = new Map<string, number>();
  for (const id of Object.values(priv?.votes ?? {})) counts.set(id, (counts.get(id) ?? 0) + 1);
  if (!counts.size) return <p className="cp-muted gc-small">No votes yet.</p>;
  return (
    <ul className="gc-tally">
      {[...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => (
          <li key={id}>
            {categoryName(view, id)}: <strong>{n}</strong>
          </li>
        ))}
    </ul>
  );
}

function MatchCard({
  lobby,
  view,
  match,
  serverNow,
  disabled,
  hostAct,
}: {
  lobby: LobbyView;
  view: GuessView;
  match: MatchPublicView;
  serverNow: () => number;
  disabled: boolean;
  hostAct: HostAct;
}) {
  const priv = view.privateMatches.find((p) => p.matchId === match.id);
  const [armed, setArmed] = useConfirm();
  const send = (type: string) => void hostAct?.({ type, payload: controlGuard(view, match) });
  const canResume =
    match.phase !== "PLAYING" || match.members.every((ids) => online(lobby, ids) > 0);
  return (
    <section className={`cp-panel gc-match gc-match-${match.phase.toLowerCase()}`}>
      <header className="gc-match-head">
        <h3>{matchLabel(match)}</h3>
        <Chip active={active(match) && !match.paused}>
          {match.paused ? "Paused" : phaseLabels[match.phase]}
        </Chip>
        {active(match) && <Timer timer={match.timer} serverNow={serverNow} />}
      </header>
      {match.phase !== "READY" && match.phase !== "CATEGORY_VOTE" && (
        <p>
          <span className="cp-muted">Category:</span>{" "}
          <strong>{categoryName(view, match.categoryId)}</strong>
        </p>
      )}
      {match.phase === "CATEGORY_VOTE" && (
        <div>
          <p>
            <strong>
              {match.votedCount}/{match.voterCount}
            </strong>{" "}
            voted
          </p>
          <VoteTally view={view} priv={priv} />
        </div>
      )}
      {match.paused && (
        <p className="gc-paused" role="status">
          <Pause size={18} strokeWidth={2.25} aria-hidden="true" /> {pauseText(match)}
        </p>
      )}
      {match.phase === "PLAYING" && (
        <p className="gc-now">
          <span className="cp-muted">Asking:</span> <Person lobby={lobby} id={match.speakerId} />
          {match.nextSpeakerId && (
            <span className="cp-muted gc-small">
              Next: <Person lobby={lobby} id={match.nextSpeakerId} size={20} />
            </span>
          )}
        </p>
      )}
      {terminal(match) && (
        <p className="gc-result-line" role="status">
          {resultText(lobby, match)}
        </p>
      )}
      <div className="gc-teams">
        <TeamRow lobby={lobby} match={match} side={0} priv={priv} serverNow={serverNow} />
        <TeamRow lobby={lobby} match={match} side={1} priv={priv} serverNow={serverNow} />
      </div>
      {!terminal(match) && (
        <div className="gc-controls">
          {active(match) &&
            (match.paused ? (
              <Button disabled={disabled || !canResume} onClick={() => send("gc:resume")}>
                Resume
              </Button>
            ) : (
              <Button disabled={disabled} onClick={() => send("gc:pause")}>
                Pause
              </Button>
            ))}
          {match.phase === "PLAYING" && (
            <Button disabled={disabled || match.paused} onClick={() => send("gc:skip")}>
              Skip turn
            </Button>
          )}
          <Button
            variant={armed === match.id ? "danger" : "secondary"}
            disabled={disabled}
            onClick={() => {
              if (armed !== match.id) return setArmed(match.id);
              setArmed(null);
              send("gc:end");
            }}
          >
            {armed === match.id ? "Tap again to end" : "End match"}
          </Button>
        </div>
      )}
      {match.paused && !canResume && (
        <p className="cp-muted gc-small">
          Resume when both teams have someone online, or end this match.
        </p>
      )}
    </section>
  );
}

export function HostSessionPanel({
  lobby,
  session,
  serverNow,
  busy = false,
  hostAct,
}: SessionViewProps) {
  const view = guessView(session);
  if (!view) return null;
  const disabled = busy || !hostAct;
  const running = view.matches.filter((m) => active(m) && !m.paused);
  const paused = view.matches.filter((m) => active(m) && m.paused);
  const done = view.matches.filter(terminal).length;
  const all = (type: string, matches: MatchPublicView[]) =>
    void hostAct?.({
      type,
      payload: { round: view.round, matches: matches.map((m) => controlGuard(view, m)) },
    });
  const resumable = paused.filter(
    (m) => m.phase !== "PLAYING" || m.members.every((ids) => online(lobby, ids) > 0),
  );
  return (
    <div className="cp-stack gc-host">
      <Panel className="cp-stack">
        <div className="cp-row cp-spread">
          <h2>Round {view.round}</h2>
          <span className="cp-muted">
            {done}/{view.matches.length} matches finished
          </span>
        </div>
        {view.canStart && (
          <>
            <p className="cp-muted">
              Teams are paired. Start the round to let every pair vote for a category.
            </p>
            <Button
              variant="primary"
              size="lg"
              disabled={disabled}
              onClick={() => void hostAct?.({ type: "gc:start", payload: { round: view.round } })}
            >
              Start round
            </Button>
          </>
        )}
        {(running.length > 0 || paused.length > 0) && (
          <div className="cp-row">
            <Button
              disabled={disabled || !running.length}
              onClick={() => all("gc:pauseAll", running)}
            >
              Pause all
            </Button>
            <Button
              disabled={disabled || !resumable.length}
              onClick={() => all("gc:resumeAll", resumable)}
            >
              Resume all
            </Button>
          </div>
        )}
        {done === view.matches.length && view.matches.length > 0 && (
          <>
            <Button
              variant="primary"
              size="lg"
              disabled={disabled || !view.canNewRound}
              onClick={() =>
                void hostAct?.({ type: "gc:newRound", payload: { round: view.round } })
              }
            >
              New round
            </Button>
            {view.newRoundIssue ? (
              <p className="cp-error">{view.newRoundIssue}</p>
            ) : (
              <p className="cp-muted">New pairs, new categories and new characters.</p>
            )}
          </>
        )}
        {done < view.matches.length && !view.canStart && (
          <p className="cp-muted">
            New round opens when every match is finished. End a match if a pair is stuck.
          </p>
        )}
      </Panel>
      <div className="gc-match-grid">
        {view.matches.map((match) => (
          <MatchCard
            key={match.id}
            lobby={lobby}
            view={view}
            match={match}
            serverNow={serverNow}
            disabled={disabled}
            hostAct={hostAct}
          />
        ))}
      </div>
    </div>
  );
}

/** The secrets tab: this group's character, held to view on the host phone. */
export function HostGroupPanel({ session, group }: GameViewProps) {
  const view = guessView(session);
  const match = view?.matches.find((m) => m.groupIds.includes(group.groupId));
  const character = view?.privateMatches
    .find((p) => p.matchId === match?.id)
    ?.characters.find((c) => c.groupId === group.groupId)?.character;
  if (!view || !match) return <span>Not in a match this round.</span>;
  return (
    <span className="cp-stack">
      <strong>{character?.name ?? "No character yet"}</strong>
      <span>{categoryName(view, match.categoryId)}</span>
    </span>
  );
}

export function HostConfigNote({ lobby, session }: { lobby: LobbyView; session: GameSessionView }) {
  const n = lobby.groups.length;
  const empty = lobby.groups.filter((g) => !g.playerIds.length).length;
  const turn = Number(session.config?.turnSeconds ?? 120);
  const cooldown = Number(session.config?.cooldownSeconds ?? 5);
  return (
    <div className="cp-stack gc-config-note">
      <p className="cp-muted">
        Needs an even number of groups (at least 2). A group can have just 1 player. Groups are
        paired at random each round.
      </p>
      <p className="cp-muted">
        Each turn ({turn} s) is one question and its answer. A wrong guess locks that team for{" "}
        {cooldown} s.
      </p>
      {n === 1 && (
        <p className="cp-error" role="alert">
          You have 1 group. Make at least 2 groups to play.
        </p>
      )}
      {n > 1 && n % 2 === 1 && (
        <p className="cp-error" role="alert">
          You have {n} groups. Make {n - 1} or {n + 1} groups to play.
        </p>
      )}
      {n === 0 && <p className="cp-error">Make groups first.</p>}
      {empty > 0 && (
        <p className="cp-error" role="alert">
          {empty === 1 ? "1 group has" : `${empty} groups have`} no players.
        </p>
      )}
    </div>
  );
}
