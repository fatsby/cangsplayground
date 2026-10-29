import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LobbyView } from "@cangsplayground/core";
import { Mic, Pause, Trophy } from "lucide-react";
import {
  Button,
  Chip,
  Panel,
  SecretCard,
  TeamBadge,
  Timer,
  Waiting,
  type SessionViewProps,
} from "@cangsplayground/ui";
import type { GuessView, MatchPrivateView, MatchPublicView } from "../types.js";
import { LanguageHelp, useHelpLevel } from "./language-help.js";
import {
  Person,
  teamIndex,
  categoryName,
  guessView,
  pauseText,
  resultText,
  useServerNow,
} from "./shared.js";
import { useGameAction } from "./use-game-action.js";

type PlayerProps = SessionViewProps & { me: NonNullable<LobbyView["me"]> };

const guardOf = (view: GuessView, match: MatchPublicView) => ({
  round: view.round,
  matchId: match.id,
  phaseVersion: match.phaseVersion,
});

function Vote({
  view,
  match,
  myVote,
  serverNow,
  send,
  disabled,
}: {
  view: GuessView;
  match: MatchPublicView;
  myVote: string | null;
  serverNow: () => number;
  send: ReturnType<typeof useGameAction>["send"];
  disabled: boolean;
}) {
  const now = useServerNow(serverNow, match.timer.endsAt !== null);
  const closed = match.timer.endsAt !== null && now >= match.timer.endsAt;
  return (
    <>
      <div className="gc-vote-status" role="status">
        <Timer timer={match.timer} serverNow={serverNow} />
        <p>
          <strong>
            {match.votedCount}/{match.voterCount}
          </strong>{" "}
          voted
          {myVote ? (
            <>
              {" "}
              · Your vote: <strong>{categoryName(view, myVote)}</strong>
            </>
          ) : (
            " · Tap a category to vote"
          )}
        </p>
        {match.paused && <p className="gc-paused">{pauseText(match)}</p>}
        {closed && !match.paused && <p className="cp-muted">Choosing the category…</p>}
      </div>
      <p className="cp-muted">
        Both teams vote. The category with the most votes wins. You can change your vote until the
        time runs out.
      </p>
      <ul className="gc-categories">
        {view.categories.map((category) => (
          <li key={category.id}>
            <button
              type="button"
              className="gc-category"
              aria-pressed={myVote === category.id}
              disabled={disabled || match.paused || closed}
              onClick={() =>
                void send({
                  type: "gc:vote",
                  payload: { ...guardOf(view, match), categoryId: category.id },
                })
              }
            >
              <strong>{category.name}</strong>
              <span>e.g. {category.examples.join(", ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

const hasLetters = (value: string) => /[\p{L}\p{N}]/u.test(value);

function GuessForm({
  view,
  match,
  priv,
  serverNow,
  send,
  pending,
  error,
}: {
  view: GuessView;
  match: MatchPublicView;
  priv: MatchPrivateView;
  serverNow: () => number;
  send: ReturnType<typeof useGameAction>["send"];
  pending: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const team = priv.teams[0];
  const cooldown = team?.cooldown;
  const now = useServerNow(serverNow, cooldown?.endsAt != null);
  const cooling =
    !!cooldown &&
    ((cooldown.endsAt !== null && now < cooldown.endsAt) || cooldown.pausedRemainingMs !== null);
  const locked = cooling || match.paused || !team;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked || pending) return;
    if (!hasLetters(name)) {
      setHint("Type a name first.");
      return;
    }
    setHint(null);
    const ok = await send({
      type: "gc:guess",
      payload: { ...guardOf(view, match), guessVersion: team!.guessVersion, name: name.trim() },
    });
    if (ok) setName("");
  };
  return (
    <form className="cp-panel gc-guess" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor="gc-guess-input">
        <h2>Guess their character</h2>
      </label>
      <p className="cp-muted">Anyone in your team can guess, at any time.</p>
      <div className="gc-guess-row">
        <input
          id="gc-guess-input"
          className="cp-input"
          value={name}
          maxLength={80}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="Type a name"
          onChange={(e) => {
            setName(e.target.value);
            setHint(null);
          }}
          aria-describedby="gc-guess-status"
        />
        <Button type="submit" variant="primary" disabled={locked || pending || !name.trim()}>
          Guess
        </Button>
      </div>
      <div id="gc-guess-status" className="gc-guess-status" aria-live="polite">
        {cooling && cooldown ? (
          <div className="gc-cooldown">
            <span>Wrong guess! Your team can guess again in</span>
            <Timer timer={cooldown} serverNow={serverNow} />
          </div>
        ) : match.paused ? (
          <span className="cp-muted">Guessing is paused.</span>
        ) : hint ? (
          <span className="cp-error">{hint}</span>
        ) : error ? (
          <span className="cp-error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Playing({
  lobby,
  view,
  match,
  priv,
  side,
  me,
  serverNow,
  action,
}: {
  lobby: LobbyView;
  view: GuessView;
  match: MatchPublicView;
  priv: MatchPrivateView;
  side: 0 | 1;
  me: string;
  serverNow: () => number;
  action: ReturnType<typeof useGameAction>;
}) {
  const [level, setLevel] = useHelpLevel();
  const ownGroup = match.groupIds[side];
  const asking = match.askingGroupId === ownGroup;
  const mine = match.speakerId === me;
  const character = priv.characters.find((c) => c.groupId === ownGroup)?.character;
  // Null on mount, so the first questioner's phone buzzes too.
  const lastTurn = useRef<number | null>(null);
  useEffect(() => {
    if (mine && lastTurn.current !== match.turnId) navigator.vibrate?.(200);
    lastTurn.current = match.turnId;
  }, [mine, match.turnId]);
  return (
    <>
      <Panel className={`gc-turn ${mine ? "gc-turn-mine" : ""}`}>
        <div className="gc-turn-head">
          <Chip active>{categoryName(view, match.categoryId)}</Chip>
          <Timer timer={match.timer} serverNow={serverNow} />
        </div>
        {match.paused ? (
          <p className="gc-paused" role="status">
            <Pause size={20} strokeWidth={2.25} aria-hidden="true" /> {pauseText(match)}
          </p>
        ) : null}
        {mine ? (
          <>
            <h2 className="gc-your-turn">
              <Mic strokeWidth={2.25} aria-hidden="true" /> Your turn to ask!
            </h2>
            <p>Ask one question. The other team answers. Then tap “I'm done”.</p>
          </>
        ) : match.speakerId ? (
          <p className="gc-speaker">
            <span>{asking ? "Your team is asking:" : "The other team is asking:"}</span>
            <strong>
              <Person lobby={lobby} id={match.speakerId} />
            </strong>
            <span className="cp-muted">
              {asking ? "Listen and help with ideas." : "Answer their question together."}
            </span>
          </p>
        ) : (
          <p className="cp-muted">Waiting for the next speaker…</p>
        )}
        {match.nextSpeakerId && (
          <p className="cp-muted gc-next">
            Next: <Person lobby={lobby} id={match.nextSpeakerId} size={22} />
            {match.nextSpeakerId === me && " (you)"}
          </p>
        )}
        {mine && (
          <Button
            variant="accent"
            size="lg"
            className="gc-done"
            disabled={action.pending || match.paused}
            onClick={() =>
              void action.send({
                type: "gc:done",
                payload: { ...guardOf(view, match), turnId: match.turnId },
              })
            }
          >
            I'm done
          </Button>
        )}
        {action.failedType === "gc:done" && (
          <p className="cp-error" role="alert">
            {action.error}
          </p>
        )}
      </Panel>
      <div className="gc-card">
        <p className="cp-muted">Your team's character. Don't let the other team see it!</p>
        {/* Remount per round so a new match always starts face down. */}
        <SecretCard key={`${view.round}:${match.id}`}>
          <span className="gc-secret-face">
            <span className="cp-muted">{categoryName(view, match.categoryId)}</span>
            <strong className="gc-secret-name">{character?.name ?? "—"}</strong>
            <span>Answer questions about this character.</span>
          </span>
        </SecretCard>
      </div>
      <GuessForm
        view={view}
        match={match}
        priv={priv}
        serverNow={serverNow}
        send={action.send}
        pending={action.pending}
        error={action.failedType === "gc:guess" ? action.error : null}
      />
      <LanguageHelp
        categoryId={match.categoryId}
        role={asking ? "question" : "answer"}
        level={level}
        onLevelChange={setLevel}
      />
    </>
  );
}

function Result({
  lobby,
  match,
  priv,
  side,
}: {
  lobby: LobbyView;
  match: MatchPublicView;
  priv: MatchPrivateView | undefined;
  side: 0 | 1;
}) {
  const won = match.phase === "FINISHED" && match.winnerGroupId === match.groupIds[side];
  const name = (groupId: string) => priv?.characters.find((c) => c.groupId === groupId)?.character;
  return (
    <Panel className="gc-result">
      {won && <Trophy size={48} strokeWidth={2.25} className="gc-trophy" aria-hidden="true" />}
      <h2 role="status">
        {won
          ? "Your team guessed it!"
          : match.phase === "FINISHED"
            ? `${lobby.groups.find((g) => g.id === match.winnerGroupId)?.name ?? "The other team"} guessed your character.`
            : resultText(lobby, match)}
      </h2>
      <dl className="gc-answers">
        <div>
          <dt>Your character</dt>
          <dd>{name(match.groupIds[side])?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>Their character</dt>
          <dd>{name(match.groupIds[side === 0 ? 1 : 0])?.name ?? "—"}</dd>
        </div>
      </dl>
      <p className="cp-muted">Wait for your teacher to start the next round.</p>
    </Panel>
  );
}

export function PlayerSessionScreen({ lobby, session, me, serverNow, act }: PlayerProps) {
  const view = guessView(session);
  const action = useGameAction(act);
  if (!view) return <Waiting />;
  const match = view.matches.find((m) => m.id === view.ownMatchId);
  if (!match)
    return (
      <div className="cp-stack gc-player">
        <Waiting message="You'll play in the next round. Watch the screen for now." />
      </div>
    );
  const side: 0 | 1 = match.members[0].includes(me.playerId) ? 0 : 1;
  const priv = view.privateMatches.find((p) => p.matchId === match.id);
  return (
    <div className="cp-stack gc-player">
      <header className="gc-player-head">
        {/* The shell header already shows my team; name the opponent here. */}
        <p className="gc-opponent">
          <span className="gc-vs">vs</span>
          <TeamBadge teamIndex={teamIndex(lobby, match.groupIds[side === 0 ? 1 : 0])} />
        </p>
        <Chip>Round {view.round}</Chip>
      </header>
      {match.phase === "READY" && (
        <Panel>
          <h1>Guess the Character</h1>
          <p>
            Your team has a secret character. Ask questions in English and guess the other team's
            character first!
          </p>
          <p className="cp-muted">Wait for your teacher to start the round.</p>
        </Panel>
      )}
      {match.phase === "CATEGORY_VOTE" && (
        <>
          <h1>Choose a category</h1>
          <Vote
            view={view}
            match={match}
            myVote={view.myVote}
            serverNow={serverNow}
            send={action.send}
            disabled={action.pending || !act}
          />
        </>
      )}
      {match.phase === "PLAYING" && priv && (
        <Playing
          lobby={lobby}
          view={view}
          match={match}
          priv={priv}
          side={side}
          me={me.playerId}
          serverNow={serverNow}
          action={action}
        />
      )}
      {(match.phase === "FINISHED" || match.phase === "ENDED") && (
        <Result lobby={lobby} match={match} priv={priv} side={side} />
      )}
      {action.error && action.failedType === "gc:vote" && (
        <p className="cp-error gc-vote-error" role="alert">
          {action.error}
        </p>
      )}
    </div>
  );
}
