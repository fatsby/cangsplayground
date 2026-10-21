import { z } from "zod";

/**
 * Secret Word — sample 2nd game proving the plugin contract (PRD §17).
 * Every player gets a private word and must slip it into their speaking turn;
 * after the round the group guesses, then the host reveals all words.
 */
export const GAME_ID = "secret-word";

export const configSchema = z.object({
  level: z.enum(["easy", "medium"]).default("easy"),
  turnSeconds: z.number().int().min(15).max(300).default(45),
});

export type SecretWordConfig = z.infer<typeof configSchema>;

export interface SecretWordData {
  /** playerId → word. `private` tier: only that player + host until revealed. */
  words: Record<string, string>;
}

export interface SecretWordPublicInfo {
  level: SecretWordConfig["level"];
  turnSeconds: number;
}

/** viewFor() output. */
export interface SecretWordGroupView {
  /** The viewer's own word (player members only). */
  myWord: string | null;
  /** Every word in the group: host always, everyone else only after reveal. */
  words: Record<string, string> | null;
}
