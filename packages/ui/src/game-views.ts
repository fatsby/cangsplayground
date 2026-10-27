import type * as React from "react";
import type {
  LobbyView,
  GameSessionView,
  GroupGameView,
  GroupSummary,
  C2SPayload,
  GameAction,
} from "@cangsplayground/core";
export interface GameViewProps {
  act?: (action: GameAction) => Promise<boolean>;
  lobby: LobbyView;
  session: GameSessionView;
  group: GroupGameView;
  serverNow: () => number;
}
export interface SessionViewProps {
  lobby: LobbyView;
  session: GameSessionView;
  serverNow: () => number;
  /** Host: a command is in flight. */
  busy?: boolean;
  act?: (action: GameAction) => Promise<boolean>;
  hostAct?: (action: GameAction) => Promise<boolean>;
}
export type GameControl = C2SPayload<"game:control">["cmd"];
export interface GameViews {
  ProjectorScreen?: React.ComponentType<SessionViewProps>;
  ProjectorTools?: React.ComponentType<SessionViewProps>;
  HostSessionPanel?: React.ComponentType<SessionViewProps>;
  PlayerSessionScreen?: React.ComponentType<
    SessionViewProps & { me: NonNullable<LobbyView["me"]> }
  >;
  roundLabel?: (group: GroupGameView, summary: GroupSummary) => string;
  HostGroupStatus?: React.ComponentType<GameViewProps>;
  ProjectorGroupStatus?: React.ComponentType<GameViewProps>;
  ProjectorMemberMark?: React.ComponentType<GameViewProps & { playerId: string }>;
  HostConfigNote?: React.ComponentType<{ lobby: LobbyView; session: GameSessionView }>;
  controlLabels?: Partial<Record<GameControl, string | null>>;
  ProjectorGroupCard?: React.ComponentType<GameViewProps>;
  HostGroupPanel?: React.ComponentType<GameViewProps>;
  PlayerTurnTip?: React.ComponentType<GameViewProps>;
  PlayerScreen: React.ComponentType<GameViewProps & { me: NonNullable<LobbyView["me"]> }>;
  ProjectorHeader?: React.ComponentType<{ session: GameSessionView }>;
}
