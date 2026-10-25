import type { GameViews } from "@cangsplayground/ui";
import { PlayerSessionScreen } from "./player.js";
import "./shark-tank.css";

const sharkTankViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
};
export default sharkTankViews;
