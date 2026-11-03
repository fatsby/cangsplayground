import type { GameViews } from "@cangsplayground/ui";
import { PlayerSessionScreen } from "./player.js";
import "./murder-mystery.css";

export { useGameAction, ACTION_TIMEOUT_MS } from "./use-game-action.js";
export { LanguageHelp, useHelpHidden } from "./language-help.js";
export { RevealSections } from "./reveal.js";
export * from "./timeline.js";

const murderMysteryViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
};
export default murderMysteryViews;
