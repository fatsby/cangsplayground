import type { GameModule } from "@clubplay/core";
import freeTalk from "@clubplay/game-free-talk";
import secretWord from "@clubplay/game-secret-word";

export const registry = new Map<string, GameModule>([
  [freeTalk.id, freeTalk],
  [secretWord.id, secretWord],
]);
