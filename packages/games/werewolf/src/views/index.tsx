import type { GameViews } from "@cangsplayground/ui";
import { HostConfigNote, HostSessionPanel } from "./host.js";
import { PlayerSessionScreen } from "./player.js";
import { ProjectorScreen } from "./projector.js";
import "./werewolf.css";
import "./host.css";

const werewolfViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
  ProjectorScreen,
  HostSessionPanel,
  HostConfigNote,
};
export default werewolfViews;
