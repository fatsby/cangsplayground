import { z } from "zod";
import type { PlayerId } from "@cangsplayground/core";
import { topicsFor } from "./topics.js";
export const GAME_ID = "whos-the-spy";
export const VOTE_MS = 30_000;
export const TURNS_BEFORE_VOTE = 2;
export type Category = "location" | "food";
export interface Topic {
  id: string;
  name: string;
  hints: [string, string, string, string];
}
export const configSchema = z
  .object({
    category: z.enum(["location", "food"]).default("location"),
    locationTopic: z.string().default("random"),
    foodTopic: z.string().default("random"),
    spies: z.number().int().min(1).max(29).default(1),
    gameMinutes: z.number().int().min(5).max(30).default(12),
    turnSeconds: z.number().int().min(15).max(300).default(60),
  })
  .refine(
    (c) =>
      (c.locationTopic === "random" ||
        topicsFor("location").some((t) => t.id === c.locationTopic)) &&
      (c.foodTopic === "random" || topicsFor("food").some((t) => t.id === c.foodTopic)),
  );
export type WhosTheSpyConfig = z.infer<typeof configSchema>;
export interface VoteResult {
  out: PlayerId | null;
  wasSpy: boolean;
  tally: Record<PlayerId, number>;
}
export interface GameResult {
  winner: "team" | "spies";
  reason: "caught" | "left" | "outnumbered" | "time";
}
export interface WhosTheSpyData {
  topicId: string;
  spies: PlayerId[];
  votes: Record<PlayerId, PlayerId>;
  voteNumber: number;
  lastVote: VoteResult | null;
  result: GameResult | null;
}
export interface WhosTheSpyPublicInfo {
  category: Category;
  turnSeconds: number;
}
export interface WhosTheSpyGroupView {
  category: Category;
  role: "civilian" | "spy" | null;
  topic: { name: string; hints: string[] } | null;
  spies: PlayerId[] | null;
  voted: PlayerId[];
  myVote: PlayerId | null;
  votes: Record<PlayerId, PlayerId> | null;
  voteNumber: number;
  lastVote: {
    out: PlayerId | null;
    wasSpy: boolean | null;
    tally: Record<PlayerId, number> | null;
  } | null;
  spiesLeft: number | null;
  result: GameResult | null;
}
