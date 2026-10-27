import freeTalkViews from "@cangsplayground/game-free-talk/views";
import secretWordViews from "@cangsplayground/game-secret-word/views";
import sharkTankViews from "@cangsplayground/game-shark-tank/views";
import type { GameViews } from "@cangsplayground/ui";
import whosTheSpyViews from "@cangsplayground/game-whos-the-spy/views";
export const gameViews: Record<string, GameViews> = {
  "free-talk": freeTalkViews,
  "secret-word": secretWordViews,
  "shark-tank": sharkTankViews,
  "whos-the-spy": whosTheSpyViews,
};
