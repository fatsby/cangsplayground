import {
  Chip,
  Panel,
  PlayerIdentity,
  TurnIndicator,
  type GameViewProps,
  type GameViews,
} from "@cangsplayground/ui";
import type { FreeTalkGroupView, FreeTalkPublicInfo } from "../types";
function info(session: GameViewProps["session"]) {
  return session.publicInfo as FreeTalkPublicInfo | null;
}
function spoken(group: GameViewProps["group"]) {
  return (group.data as FreeTalkGroupView | null)?.spoken ?? [];
}
function ProjectorHeader({ session }: { session: GameViewProps["session"] }) {
  return <p className="game-prompt">{info(session)?.prompt || "Free Talk · Talk and listen"}</p>;
}
function ProjectorGroupCard({ group }: GameViewProps) {
  return (
    <p className="game-progress">
      Spoken {spoken(group).length} / {group.turnCount}
    </p>
  );
}
function Order({ lobby, group }: Pick<GameViewProps, "lobby" | "group">) {
  const done = spoken(group);
  return (
    <ol className="speaking-order">
      {group.turnOrder?.map((id, index) => (
        <li key={`${id}-${index}`} className={index === group.turnIndex ? "order-current" : ""}>
          <PlayerIdentity player={lobby.players.find((p) => p.id === id)} playerId={id} />
          <span className="cp-muted">
            {index < group.turnIndex
              ? "Spoken"
              : index === group.turnIndex
                ? "Now"
                : done.includes(id)
                  ? "Again"
                  : "Next"}
          </span>
        </li>
      ))}
    </ol>
  );
}
function HostGroupPanel({ lobby, group }: GameViewProps) {
  return (
    <div className="cp-stack">
      <p>No secrets in Free Talk</p>
      <Order lobby={lobby} group={group} />
    </div>
  );
}
function PlayerScreen({
  lobby,
  session,
  group,
}: GameViewProps & { me: NonNullable<GameViewProps["lobby"]["me"]> }) {
  return (
    <div className="cp-stack free-talk-player">
      <Panel className="cp-stack">
        <Chip>Free Talk · Round {group.round}</Chip>
        <h2>Let’s talk</h2>
        <p>{info(session)?.prompt || "Tell your group about your day."}</p>
        <TurnIndicator
          currentPlayer={lobby.players.find((p) => p.id === group.currentSpeakerId)}
          nextPlayer={lobby.players.find((p) => p.id === group.nextSpeakerId)}
          current={lobby.players.find((p) => p.id === group.currentSpeakerId)?.name}
          next={lobby.players.find((p) => p.id === group.nextSpeakerId)?.name}
        />
      </Panel>
      <Panel className="cp-stack">
        <h2>Speaking order</h2>
        <Order lobby={lobby} group={group} />
      </Panel>
    </div>
  );
}
export const freeTalkViews: GameViews = {
  ProjectorHeader,
  ProjectorGroupCard,
  HostGroupPanel,
  PlayerScreen,
};
export default freeTalkViews;
