import { z } from "zod";

export const GAME_ID = "werewolf";

/** Everyone needs at least this many players for a game to start. */
export const MIN_PLAYERS = 5;
/** How long the private role card stays available before the first night. */
export const REVEAL_MS = 10_000;
/** Length of the dawn announcement; must be at least as long as the kill animation (~7.4 s). */
export const DAWN_MS = 8_000;
/** Length of the vote-result reveal that plays between the vote and the next night or the final screen. */
export const VERDICT_MS = 9_000;

export const ROLES = ["werewolf", "villager", "seer", "guard"] as const;
export type Role = (typeof ROLES)[number];
export type Team = "village" | "wolves";

/** Phases of one game. Order: SETUP, REVEAL, then NIGHT/DAWN/DISCUSSION/VOTE/VERDICT repeating, then ENDED. */
export type Stage = "SETUP" | "REVEAL" | "NIGHT" | "DAWN" | "DISCUSSION" | "VOTE" | "VERDICT" | "ENDED";

/**
 * Host-editable timings, in seconds. The role-reveal, dawn and verdict periods are fixed
 * constants because their length is dictated by the animations they host.
 */
export const configSchema = z.object({
  nightSeconds: z.number().int().min(10).max(120).default(30),
  discussionSeconds: z.number().int().min(30).max(600).default(180),
  voteSeconds: z.number().int().min(15).max(180).default(60),
});

export type WerewolfConfig = z.infer<typeof configSchema>;
