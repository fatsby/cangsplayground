import type { GameModule } from "@cangsplayground/core";
import freeTalk from "@cangsplayground/game-free-talk";
import secretWord from "@cangsplayground/game-secret-word";

export const registry = new Map<string, GameModule>([
  [freeTalk.id, freeTalk],
  [secretWord.id, secretWord],
]);
