import {
  Chip,
  Panel,
  PlayerIdentity,
  SecretCard,
  TurnIndicator,
  type GameViewProps,
  type GameViews,
} from "@cangsplayground/ui";
import type { SecretWordGroupView, SecretWordPublicInfo } from "../types";
import "./secret-word.css";

type PlayerProps = GameViewProps & { me: NonNullable<GameViewProps["lobby"]["me"]> };

function info(session: GameViewProps["session"]) {
  return session.publicInfo as SecretWordPublicInfo | null;
}
function data(group: GameViewProps["group"]) {
  return (group.data as SecretWordGroupView | null) ?? { myWord: null, words: null };
}
function nameOf(lobby: GameViewProps["lobby"], id: string | null) {
  return lobby.players.find((p) => p.id === id)?.name;
}

/** Words of one group as a list; only rendered when the server sent them (host, or after reveal). */
function WordList({
  lobby,
  words,
}: {
  lobby: GameViewProps["lobby"];
  words: Record<string, string>;
}) {
  return (
    <ul className="sw-words">
      {Object.entries(words).map(([id, word]) => (
        <li key={id}>
          <PlayerIdentity player={lobby.players.find((p) => p.id === id)} playerId={id} size={28} />
          <span className="sw-word">{word}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectorHeader({ session }: { session: GameViewProps["session"] }) {
  const level = info(session)?.level === "medium" ? "Medium words" : "Easy words";
  return <p className="game-prompt">Secret Word · Use your word when you speak · {level}</p>;
}

function ProjectorGroupCard({ lobby, group }: GameViewProps) {
  const { words } = data(group);
  if (!words) return <p className="game-progress">Listen. Who used a secret word?</p>;
  return <WordList lobby={lobby} words={words} />;
}

function HostGroupPanel({ lobby, group }: GameViewProps) {
  const { words } = data(group);
  return words ? <WordList lobby={lobby} words={words} /> : <p>No words yet</p>;
}

function PlayerScreen({ lobby, group }: PlayerProps) {
  const { myWord, words } = data(group);
  const ended = group.phase === "ROUND_END";
  return (
    <div className="cp-stack free-talk-player">
      <Panel className="cp-stack">
        <Chip>Secret Word · Round {group.round}</Chip>
        <h2>{ended ? "Who used which word?" : "Use your word in your talk"}</h2>
        {myWord && !words && (
          <SecretCard>
            <span className="sw-card">
              <span className="cp-muted">Your secret word</span>
              <strong className="sw-word">{myWord}</strong>
            </span>
          </SecretCard>
        )}
        {!ended && (
          <TurnIndicator
            currentPlayer={lobby.players.find((p) => p.id === group.currentSpeakerId)}
            nextPlayer={lobby.players.find((p) => p.id === group.nextSpeakerId)}
            current={nameOf(lobby, group.currentSpeakerId)}
            next={nameOf(lobby, group.nextSpeakerId)}
          />
        )}
      </Panel>
      {words && (
        <Panel className="cp-stack">
          <h2>All words</h2>
          <WordList lobby={lobby} words={words} />
        </Panel>
      )}
    </div>
  );
}

export const secretWordViews: GameViews = {
  ProjectorHeader,
  ProjectorGroupCard,
  HostGroupPanel,
  PlayerScreen,
};
export default secretWordViews;
