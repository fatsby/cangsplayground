import freeTalkViews from "@cangsplayground/game-free-talk/views";
import secretWordViews from "@cangsplayground/game-secret-word/views";
import type { GameViews } from "@cangsplayground/ui";
export const gameViews: Record<string, GameViews> = {
  "free-talk": freeTalkViews,
  "secret-word": secretWordViews,
};
