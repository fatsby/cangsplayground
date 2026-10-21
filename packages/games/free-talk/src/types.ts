import { z } from "zod";

/**
 * Free Talk Timer (GAME-07) — shared by logic (server) and views (web).
 * Each group rotates speaking turns; every turn lasts `turnSeconds`; the host's
 * prompt is public and shown on the projector.
 */
export const GAME_ID = "free-talk";

export const configSchema = z.object({
  prompt: z.string().trim().max(200).default(""),
  turnSeconds: z.number().int().min(15).max(300).default(60),
  turnsPerPlayer: z.number().int().min(1).max(3).default(1),
});

export type FreeTalkConfig = z.infer<typeof configSchema>;

/** Per-group module data: nothing secret in this game. */
export interface FreeTalkData {
  /** Player ids who finished their turn this round, in order. */
  spoken: string[];
}

/** publicInfo(config) — safe for every viewer. */
export interface FreeTalkPublicInfo {
  prompt: string;
  turnSeconds: number;
}

/** viewFor() output — identical for every viewer since the game has no secrets. */
export interface FreeTalkGroupView {
  spoken: string[];
}
