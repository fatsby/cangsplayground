import type * as React from "react";
import type {
  LobbyView,
  GameSessionView,
  GroupGameView,
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
export type GameControl = C2SPayload<"game:control">["cmd"];
export interface GameViews {
  controlLabels?: Partial<Record<GameControl, string | null>>;
  ProjectorGroupCard?: React.ComponentType<GameViewProps>;
  HostGroupPanel?: React.ComponentType<GameViewProps>;
  PlayerTurnTip?: React.ComponentType<GameViewProps>;
  PlayerScreen: React.ComponentType<GameViewProps & { me: NonNullable<LobbyView["me"]> }>;
  ProjectorHeader?: React.ComponentType<{ session: GameSessionView }>;
}
