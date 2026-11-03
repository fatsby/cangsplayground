import type { GameViews } from "@cangsplayground/ui";
import { HostConfigNote, HostGroupPanel, HostSessionPanel } from "./host.js";
import { PlayerSessionScreen } from "./player.js";
import { ProjectorScreen } from "./projector.js";
import "./murder-mystery.css";

export { IntroStage } from "./intro.js";

export { useGameAction, ACTION_TIMEOUT_MS } from "./use-game-action.js";
export { LanguageHelp, useHelpHidden } from "./language-help.js";
export { RevealSections } from "./reveal.js";
export * from "./timeline.js";

const murderMysteryViews: GameViews = {
  PlayerScreen: () => null,
  PlayerSessionScreen,
  ProjectorScreen,
  HostSessionPanel,
  HostGroupPanel,
  HostConfigNote,
};
export default murderMysteryViews;
