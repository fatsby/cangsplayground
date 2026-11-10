import type { GameModule } from "@cangsplayground/core";
import freeTalk from "@cangsplayground/game-free-talk";
import secretWord from "@cangsplayground/game-secret-word";

import whosTheSpy from "@cangsplayground/game-whos-the-spy";
import sharkTank from "@cangsplayground/game-shark-tank";
import guessTheCharacter from "@cangsplayground/game-guess-the-character";
import murderMystery from "@cangsplayground/game-murder-mystery";
import werewolf from "@cangsplayground/game-werewolf";

export const registry = new Map<string, GameModule>([
  [freeTalk.id, freeTalk],
  [secretWord.id, secretWord],
  [whosTheSpy.id, whosTheSpy],
  [sharkTank.id, sharkTank],
  [guessTheCharacter.id, guessTheCharacter],
  [murderMystery.id, murderMystery],
  [werewolf.id, werewolf],
]);
