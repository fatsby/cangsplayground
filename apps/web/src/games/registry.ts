import freeTalkViews from "@clubplay/game-free-talk/views";
import secretWordViews from "@clubplay/game-secret-word/views";
import type { GameViews } from "@clubplay/ui";
export const gameViews: Record<string, GameViews> = {
  "free-talk": freeTalkViews,
  "secret-word": secretWordViews,
};
