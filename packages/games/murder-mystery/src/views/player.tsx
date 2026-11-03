import { useEffect, useState } from "react";
import type { GameAction } from "@cangsplayground/core";
import type { LobbyView } from "@cangsplayground/core";
import { Chip, Panel, Timer, Waiting, type SessionViewProps } from "@cangsplayground/ui";
import type { ActionOption, MurderView } from "../types.js";
import { ClueCard } from "./clue-card.js";
import { ConclusionPanel } from "./conclusion.js";
import { LanguageHelp, useHelpHidden } from "./language-help.js";
import { RevealSections } from "./reveal.js";
import { ROUNDS, murderView } from "./shared.js";
import { useGameAction } from "./use-game-action.js";

type PlayerProps = SessionViewProps & { me: NonNullable<LobbyView["me"]> };
type Own = NonNullable<MurderView["ownTeam"]>;

const KIND_TITLES: Record<ActionOption["kind"], string> = {
  alibi: "Ask about an alibi",
  relationship: "Ask about a relationship",
  inspect: "Inspect something",
  challenge: "Challenge with evidence",
};
const KIND_ORDER: ActionOption["kind"][] = ["alibi", "relationship", "inspect", "challenge"];

const playerName = (lobby: LobbyView, id: string | null): string =>
  (id && lobby.players.find((p) => p.id === id)?.name) || "A teammate";

function ClockBar({ view, serverNow }: { view: MurderView; serverNow: () => number }) {
  if (view.clock.endsAt === null && view.clock.remainingMs === null) return null;
  return (
    <Timer
      timer={{
        endsAt: view.clock.endsAt,
        pausedRemainingMs: view.clock.remainingMs,
        durationMs: view.clock.durationMs,
      }}
      serverNow={serverNow}
    />
  );
}

function Briefing({ view }: { view: MurderView }) {
  const b = view.briefing;
  if (!b) return <Waiting message="The case file will open soon." />;
  return (
    <div className="cp-stack mm-briefing">
      <Panel>
        <h1>{b.title}</h1>
        <p>{b.opening}</p>
        <p className="cp-muted">
          Victim: <strong>{b.victim.name}</strong>. {b.victim.description} Found at {b.bodyFoundAt}.
        </p>
      </Panel>
      {(
        [
          ["Suspects", b.suspects],
          ["Weapons", b.weapons],
          ["Rooms", b.rooms],
        ] as const
      ).map(([title, list]) => (
        <Panel key={title}>
          <h2>{title}</h2>
          <ul className="mm-entities">
            {list.map((entity) => (
              <li key={entity.id}>
                <strong>{entity.name}</strong>
                <span className="cp-muted"> {entity.description}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function Investigation({
  view,
  own,
  lobby,
  send,
  pending,
  error,
}: {
  view: MurderView;
  own: Own;
  lobby: LobbyView;
  send: (action: GameAction) => Promise<boolean>;
  pending: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // A phase or round change clears a selection that was never confirmed.
  useEffect(() => setSelected(null), [view.phaseVersion, view.investigationRound]);
  const choice = own.options.find((o) => o.id === selected) ?? null;
  const lead = playerName(lobby, own.leadId);
  const acted = own.history.some((h) => h.round === view.investigationRound);
  const confirm = () =>
    choice &&
    send({
      type: "mm:investigate",
      payload: {
        caseNumber: view.caseNumber,
        phaseVersion: view.phaseVersion,
        round: view.investigationRound,
        actionId: choice.id,
      },
    });
  return (
    <div className="cp-stack mm-investigation">
      <header className="mm-round-head">
        <Chip>
          Round {view.investigationRound} of {ROUNDS}
        </Chip>
        <h1>
          {own.canInvestigate
            ? `You lead Round ${view.investigationRound}`
            : `${lead} leads Round ${view.investigationRound}`}
        </h1>
      </header>
      {acted ? (
        <Panel aria-live="polite">
          <h2>Your team has asked</h2>
          <p>{own.history[own.history.length - 1]?.label}</p>
          <p className="cp-muted">
            The leader reads the new clue aloud. Compare it with what you know.
          </p>
        </Panel>
      ) : own.canInvestigate ? (
        <>
          <p>Talk with your team first. Then choose one investigation.</p>
          {KIND_ORDER.map((kind) => {
            const list = own.options.filter((o) => o.kind === kind);
            if (list.length === 0) return null;
            return (
              <details
                key={kind}
                className="cp-panel mm-group"
                open={list.some((o) => o.id === selected)}
              >
                <summary>{KIND_TITLES[kind]}</summary>
                {list.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="cp-btn cp-btn-secondary mm-option"
                    aria-pressed={selected === option.id}
                    onClick={() => setSelected(option.id)}
                  >
                    <strong>{option.targetLabel}</strong>
                    <span>{option.prompt}</span>
                  </button>
                ))}
              </details>
            );
          })}
          {choice && (
            <Panel className="mm-confirm" role="alertdialog" aria-label="Confirm investigation">
              <h2>Ask this?</h2>
              <p>
                <strong>Who or what:</strong> {choice.targetLabel}
              </p>
              <p>
                <strong>Topic:</strong> {choice.prompt}
              </p>
              {choice.evidence.length > 0 && (
                <p>
                  <strong>Evidence you use:</strong>{" "}
                  {choice.evidence.map((e) => e.label).join(", ")}
                </p>
              )}
              <button
                type="button"
                className="cp-btn cp-btn-primary"
                disabled={pending}
                onClick={confirm}
              >
                Yes, investigate
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-ghost"
                disabled={pending}
                onClick={() => setSelected(null)}
              >
                Choose again
              </button>
            </Panel>
          )}
        </>
      ) : (
        <Panel>
          <p>
            {view.paused
              ? "The teacher paused the game."
              : `${lead} chooses the next investigation. Give your ideas!`}
          </p>
          {own.options.length > 0 && (
            <ul className="mm-ideas">
              {own.options.map((o) => (
                <li key={o.id}>{o.prompt}</li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PrivateClues({ own }: { own: Own }) {
  if (own.myCards.length === 0) return null;
  return (
    <section className="cp-stack mm-private" aria-label="Your clues">
      <h2>Your clues</h2>
      <p className="cp-muted">Hold the card to read it. Tell your team in your own words.</p>
      {own.myCards.map((card) => (
        <ClueCard key={card.id} card={card} concealed />
      ))}
    </section>
  );
}

/**
 * The phone screen of a Murder Mystery player. Everything shown comes from the projected view the
 * server sent for this device; nothing is derived from the case itself.
 */
export function PlayerSessionScreen({ lobby, session, me, serverNow, act }: PlayerProps) {
  const view = murderView(session);
  const action = useGameAction(act);
  const [helpHidden, setHelpHidden] = useHelpHidden();
  if (!view) return <Waiting />;
  const own = view.ownTeam;
  const help = (
    <LanguageHelp phase={view.phase} hidden={helpHidden} onHiddenChange={setHelpHidden} />
  );

  if (!own) {
    return (
      <div className="cp-stack mm-player">
        {view.briefing && view.phase !== "READY" && view.phase !== "INTRO" && (
          <Briefing view={view} />
        )}
        <Waiting message="You'll join the investigation in the next case. Watch the screen for now." />
      </div>
    );
  }

  return (
    <div className="cp-stack mm-player">
      {view.paused && <p className="cp-banner mm-paused">The teacher paused the game.</p>}
      {view.phase !== "READY" && view.phase !== "AWAITING_REVEAL" && view.phase !== "REVEALED" && (
        <ClockBar view={view} serverNow={serverNow} />
      )}
      {view.phase === "READY" && (
        <Panel>
          <h1>Murder Mystery</h1>
          <p>
            Your team solves one case together. Share your clues in English, investigate four times,
            then explain one answer.
          </p>
          <h2>Your team</h2>
          <ul className="mm-members">
            {own.members.map((id) => (
              <li key={id}>
                {playerName(lobby, id)}
                {id === me.playerId ? " (you)" : ""}
              </li>
            ))}
          </ul>
          <p className="cp-muted">Wait for your teacher to start.</p>
        </Panel>
      )}
      {view.phase === "INTRO" && (
        <Panel className="mm-watch">
          <h1>Watch the projector</h1>
          <p className="cp-muted">The case starts in a moment.</p>
        </Panel>
      )}
      {view.phase === "BRIEFING" && (
        <>
          <Briefing view={view} />
          {help}
        </>
      )}
      {view.phase === "SHARING" && (
        <>
          <h1>Share your clues</h1>
          <PrivateClues own={own} />
          {help}
        </>
      )}
      {view.phase === "INVESTIGATION" && (
        <>
          <Investigation
            view={view}
            own={own}
            lobby={lobby}
            send={action.send}
            pending={action.pending}
            error={action.error}
          />
          <PrivateClues own={own} />
          {help}
        </>
      )}
      {view.phase === "CONCLUSION" && (
        <>
          <ConclusionPanel
            view={view}
            own={own}
            send={action.send}
            pending={action.pending}
            error={action.error}
            submitterName={playerName(lobby, own.submitterId)}
          />
          {help}
        </>
      )}
      {view.phase === "AWAITING_REVEAL" && (
        <Panel aria-live="polite">
          <h1>{own.submission ? "Answer submitted" : "Time is up"}</h1>
          <p>
            {own.submission
              ? "Your team's answer is locked."
              : "Your team did not submit an answer."}{" "}
            Wait for the teacher to reveal the solution.
          </p>
        </Panel>
      )}
      {view.phase === "REVEALED" && (
        <RevealSections
          view={view}
          serverNow={serverNow}
          teamName={(groupId) => lobby.groups.find((g) => g.id === groupId)?.name ?? groupId}
        />
      )}
    </div>
  );
}
