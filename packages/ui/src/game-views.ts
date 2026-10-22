import type * as React from "react";
import type { LobbyView, GameSessionView, GroupGameView } from "@cangsplayground/core";
export interface GameViewProps {
  lobby: LobbyView;
  session: GameSessionView;
  group: GroupGameView;
  serverNow: () => number;
}
export interface GameViews {
  ProjectorGroupCard?: React.ComponentType<GameViewProps>;
  HostGroupPanel?: React.ComponentType<GameViewProps>;
  PlayerScreen: React.ComponentType<GameViewProps & { me: NonNullable<LobbyView["me"]> }>;
  ProjectorHeader?: React.ComponentType<{ session: GameSessionView }>;
}
