import type { GameViews } from "@cangsplayground/ui";
import { PlayerSessionScreen } from "./player.js";
import "./werewolf.css";

const werewolfViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
};
export default werewolfViews;
