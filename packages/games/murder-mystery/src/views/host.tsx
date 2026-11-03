import { useEffect, useState } from "react";
import type { GameViewProps, SessionViewProps } from "@cangsplayground/ui";
import type { GameSessionView, LobbyView } from "@cangsplayground/core";
import { Button, Chip, Panel, Timer } from "@cangsplayground/ui";
import type { MurderView, Phase } from "../types.js";
import { rankLabel } from "./reveal.js";
import { ROUNDS, murderView } from "./shared.js";
import { useGameAction } from "./use-game-action.js";

type Details = NonNullable<MurderView["hostDetails"]>;
type TeamDetails = Details["teams"][number];

const PHASE_LABELS: Record<Phase, string> = {
  READY: "Ready",
  INTRO: "Intro",
  BRIEFING: "Case briefing",
  SHARING: "Sharing clues",
  INVESTIGATION: "Investigation",
  CONCLUSION: "Final answers",
  AWAITING_REVEAL: "Waiting to reveal",
  REVEALED: "Solution",
};
const TIMED: Phase[] = ["BRIEFING", "SHARING", "INVESTIGATION", "CONCLUSION"];
const EXTEND_SECONDS = 30;
/** Rough teaching time after the answers are in; there is no timer for it. */
const REVEAL_MINUTES = 3;

const teamNameOf = (lobby: LobbyView, groupId: string): string =>
  lobby.groups.find((g) => g.id === groupId)?.name ?? groupId;
const playerNameOf = (lobby: LobbyView, id: string): string =>
  lobby.players.find((p) => p.id === id)?.name ?? id;

/** Moving a team's clues and turns to a connected teammate. */
function TeamPanel({
  lobby,
  view,
  team,
  disabled,
  send,
}: {
  lobby: LobbyView;
  view: MurderView;
  team: TeamDetails;
  disabled: boolean;
  send: (action: { type: string; payload: Record<string, unknown> }) => Promise<boolean>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const name = teamNameOf(lobby, team.groupId);
  const progress = view.progress.find((p) => p.groupId === team.groupId);
  const targets = team.connected.filter((id) => id !== from);
  const cards = view.hostDetails?.cards ?? [];
  return (
    <Panel className="cp-stack mm-host-team">
      <div className="cp-row cp-spread">
        <h3>{name}</h3>
        <span className="cp-muted">
          {progress?.submitted ? "Submitted" : progress?.acted ? "Investigated" : "Working"}
        </span>
      </div>
      {!progress?.active && <p className="cp-error">{name} has no players left.</p>}
      {progress?.active && team.connected.length === 0 && (
        <p className="cp-error">Nobody is online in {name}.</p>
      )}
      <ul className="mm-host-members">
        {team.members.map((id) => {
          const held = Object.entries(team.owners).filter(([, owner]) => owner === id);
          return (
            <li key={id}>
              <strong>{playerNameOf(lobby, id)}</strong>{" "}
              <span className="cp-muted">
                {team.connected.includes(id) ? "online" : "offline"}; {held.length} clue
                {held.length === 1 ? "" : "s"}; leads{" "}
                {team.leadOrder
                  .map((lead, i) => (lead === id ? i + 1 : null))
                  .filter(Boolean)
                  .join(", ") || "none"}
              </span>
              <details>
                <summary>Clues</summary>
                {held.map(([cardId]) => {
                  const card = cards.find((c) => c.id === cardId);
                  return card ? (
                    <p key={cardId}>
                      <strong>{card.sourceLabel}.</strong> {card.body}
                    </p>
                  ) : null;
                })}
              </details>
            </li>
          );
        })}
      </ul>
      <div className="mm-reassign">
        <select
          aria-label={`Move from, ${name}`}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setTo("");
          }}
        >
          <option value="">Move from…</option>
          {team.members.map((id) => (
            <option key={id} value={id}>
              {playerNameOf(lobby, id)}
            </option>
          ))}
        </select>
        <select aria-label={`Move to, ${name}`} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Move to…</option>
          {targets.map((id) => (
            <option key={id} value={id}>
              {playerNameOf(lobby, id)}
            </option>
          ))}
        </select>
        <Button
          disabled={disabled || !from || !to}
          onClick={() =>
            void send({
              type: "mm:transfer",
              payload: {
                caseNumber: view.caseNumber,
                phaseVersion: view.phaseVersion,
                groupId: team.groupId,
                fromPlayerId: from,
                toPlayerId: to,
              },
            })
          }
        >
          Reassign
        </Button>
      </div>
    </Panel>
  );
}

/**
 * The teacher's console for Murder Mystery: Start, Pause/Resume, +30s, Next (with a warning that
 * names unfinished teams), Reveal and New case, plus reassignment and a full look at the case.
 * Every command carries the current case and phase version so a late tap cannot act on a newer
 * state, and one command is in flight at a time.
 */
export function HostSessionPanel({
  lobby,
  session,
  serverNow,
  busy = false,
  hostAct,
}: SessionViewProps) {
  const view = murderView(session);
  const run = useGameAction(hostAct);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [view?.phaseVersion]);
  if (!view) return null;
  const disabled = busy || run.pending || !hostAct;
  const guard = { caseNumber: view.caseNumber, phaseVersion: view.phaseVersion };
  const send = (type: string, extra: Record<string, unknown> = {}) =>
    run.send({ type, payload: { ...guard, ...extra } });
  const phase = view.phase;
  const timed = TIMED.includes(phase);
  const names = (list: { groupId: string }[]) =>
    list.map((p) => teamNameOf(lobby, p.groupId)).join(", ");
  const unfinished =
    phase === "INVESTIGATION"
      ? view.progress.filter((p) => p.active && !p.acted)
      : phase === "CONCLUSION"
        ? view.progress.filter((p) => p.active && !p.submitted)
        : [];
  const details = view.hostDetails;

  return (
    <div className="cp-stack mm-host">
      <Panel className="cp-stack">
        <div className="cp-row cp-spread">
          <h2>{PHASE_LABELS[phase]}</h2>
          {phase === "INVESTIGATION" && (
            <Chip>
              Round {view.investigationRound} of {ROUNDS}
            </Chip>
          )}
        </div>
        {(view.clock.endsAt !== null || view.clock.remainingMs !== null) && (
          <Timer
            timer={{
              endsAt: view.clock.endsAt,
              pausedRemainingMs: view.clock.remainingMs,
              durationMs: view.clock.durationMs,
            }}
            serverNow={serverNow}
          />
        )}
        {view.paused && <p className="cp-banner">The game is paused.</p>}

        {phase === "READY" && (
          <>
            <p className="cp-muted">
              Start plays a 13-second intro on the projector, then the case briefing begins.
            </p>
            <Button
              variant="primary"
              size="lg"
              disabled={disabled}
              onClick={() => void send("mm:start")}
            >
              Start
            </Button>
          </>
        )}

        {phase === "INTRO" && (
          <div className="cp-row">
            <Button
              disabled={disabled}
              onClick={() => void send(view.paused ? "mm:resume" : "mm:pause")}
            >
              {view.paused ? "Resume" : "Pause"}
            </Button>
            <Button disabled={disabled} onClick={() => void send("mm:next")}>
              Skip intro
            </Button>
          </div>
        )}

        {timed && (
          <>
            <div className="cp-row">
              <Button
                disabled={disabled}
                onClick={() => void send(view.paused ? "mm:resume" : "mm:pause")}
              >
                {view.paused ? "Resume" : "Pause"}
              </Button>
              <Button
                disabled={disabled}
                onClick={() => void send("mm:extend", { seconds: EXTEND_SECONDS })}
              >
                +{EXTEND_SECONDS}s
              </Button>
              <Button disabled={disabled || view.paused} onClick={() => setConfirming(true)}>
                Next
              </Button>
            </div>
            {confirming && (
              <Panel
                className="cp-stack mm-confirm"
                role="alertdialog"
                aria-label="Confirm moving on"
              >
                <h3>Move on now?</h3>
                {phase === "INVESTIGATION" && unfinished.length > 0 && (
                  <p>
                    These teams will lose Round {view.investigationRound}: {names(unfinished)}.
                  </p>
                )}
                {phase === "CONCLUSION" && unfinished.length > 0 && (
                  <p>These teams have not submitted and will score nothing: {names(unfinished)}.</p>
                )}
                {unfinished.length === 0 && (
                  <p>Every team has finished. The remaining time will be skipped.</p>
                )}
                <Button variant="primary" disabled={disabled} onClick={() => void send("mm:next")}>
                  Yes, move on
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Stay here
                </Button>
              </Panel>
            )}
          </>
        )}

        {phase === "AWAITING_REVEAL" && (
          <>
            <p className="cp-muted">
              All answers are closed. Reveal shows the solution to everyone, with about{" "}
              {REVEAL_MINUTES} minutes to discuss.
            </p>
            <Button
              variant="primary"
              size="lg"
              disabled={disabled}
              onClick={() => void send("mm:reveal")}
            >
              Reveal
            </Button>
          </>
        )}

        {phase === "REVEALED" && (
          <>
            <ol className="mm-host-results">
              {(view.results ?? []).map((row) => (
                <li key={row.groupId} className="mm-host-result">
                  {rankLabel(row.rank, view.results ?? [])}. {teamNameOf(lobby, row.groupId)}:{" "}
                  <strong>{row.score.total}</strong> / 10
                </li>
              ))}
            </ol>
            <Button
              variant="primary"
              size="lg"
              disabled={disabled}
              onClick={() => void send("mm:newCase")}
            >
              New case
            </Button>
          </>
        )}

        {run.error && (
          <p className="cp-error" role="alert">
            {run.error}
          </p>
        )}
      </Panel>

      {details && (
        <>
          <Panel className="cp-stack">
            <h3>Teams</h3>
            {details.teams.map((team) => (
              <TeamPanel
                key={team.groupId}
                lobby={lobby}
                view={view}
                team={team}
                disabled={disabled}
                send={run.send}
              />
            ))}
          </Panel>
          <Panel className="cp-stack mm-host-solution">
            <details>
              <summary>Solution (only you can see this)</summary>
              <ol>
                {details.solution.events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ol>
              {details.cards.map((card) => (
                <p key={card.id}>
                  <strong>{card.sourceLabel}.</strong> {card.body}
                </p>
              ))}
            </details>
          </Panel>
        </>
      )}
    </div>
  );
}

/**
 * What the teacher should know before pressing Prepare: team sizes, the time the case takes and
 * the reveal allowance.
 */
export function HostConfigNote({ lobby, session }: { lobby: LobbyView; session: GameSessionView }) {
  const config = (session.config ?? {}) as Record<string, number>;
  const seconds =
    (config.briefingSeconds ?? 120) +
    (config.sharingSeconds ?? 180) +
    ROUNDS * (config.investigationSeconds ?? 180) +
    (config.conclusionSeconds ?? 240);
  const minutes = Math.round(seconds / 60);
  const wrong = lobby.groups.filter((g) => g.playerIds.length < 3 || g.playerIds.length > 4);
  return (
    <div className="cp-stack mm-config-note">
      <p className="cp-muted">
        Each team needs 3-4 players. Any number of teams can play, even one. All teams solve the
        same case at the same time.
      </p>
      <p className="cp-muted">
        The case takes {minutes} timed minutes, plus a fixed 13-second intro and about{" "}
        {REVEAL_MINUTES} minutes to reveal and discuss.
      </p>
      {lobby.groups.length === 0 && <p className="cp-error">Make groups first.</p>}
      {wrong.map((g) => (
        <p key={g.id} className="cp-error" role="alert">
          {g.name} has {g.playerIds.length} player{g.playerIds.length === 1 ? "" : "s"}. Each team
          needs 3-4 players.
        </p>
      ))}
    </div>
  );
}

/** Murder Mystery has no per-group host panel; everything is class-wide. */
export function HostGroupPanel(props: GameViewProps) {
  void props;
  return null;
}
