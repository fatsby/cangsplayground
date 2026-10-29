import type { GameViews } from "@cangsplayground/ui";
import { PlayerSessionScreen } from "./player.js";
import { HostConfigNote, HostGroupPanel, HostSessionPanel } from "./host.js";
import { ProjectorHeader, ProjectorScreen } from "./projector.js";
import "./guess-the-character.css";

export { LanguageHelp, useHelpLevel } from "./language-help.js";
export { useGameAction, ACTION_TIMEOUT_MS } from "./use-game-action.js";

const guessTheCharacterViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
  ProjectorScreen,
  ProjectorHeader,
  HostSessionPanel,
  HostGroupPanel,
  HostConfigNote,
};
export default guessTheCharacterViews;
