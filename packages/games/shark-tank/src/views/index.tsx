import type { GameViews } from "@cangsplayground/ui";
import { PlayerSessionScreen } from "./player.js";
import { HostConfigNote, HostGroupPanel, HostSessionPanel } from "./host.js";
import { ProjectorScreen, ProjectorTools } from "./projector.js";
import "./shark-tank.css";
import "./results.css";

const sharkTankViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
  ProjectorScreen,
  ProjectorTools,
  HostSessionPanel,
  HostGroupPanel,
  HostConfigNote,
};
export default sharkTankViews;
