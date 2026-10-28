import { z } from "zod";
import type { GroupId, PlayerId, TimerState } from "@cangsplayground/core";
import type { Results } from "./rules.js";

export const GAME_ID = "shark-tank";
export const configSchema = z
  .object({
    prepMinutes: z.number().int().min(5).max(40).default(15),
    pitchSeconds: z.number().int().min(30).max(600).default(120),
    qaSeconds: z.number().int().min(30).max(900).default(180),
    huddleSeconds: z.number().int().min(30).max(300).default(90),
    moneyPerMember: z.number().int().min(10).max(1000).default(100),
    minPrice: z.number().int().min(1).max(1000).default(10),
    maxPrice: z.number().int().min(1).max(1000).default(60),
    minSpendPercent: z.number().int().min(0).max(100).default(60),
    noQuestionPenalty: z.number().int().min(0).max(500).default(20),
  })
  .refine((config) => config.minPrice <= config.maxPrice, {
    message: "Minimum price must not exceed maximum price.",
  });
export type SharkTankConfig = z.infer<typeof configSchema>;
export type PartId = "problem" | "product" | "story" | "price" | "ask";
export const PART_ORDER: PartId[] = ["problem", "product", "story", "price", "ask"];
export type Stage = "PREP" | "PITCH" | "QA" | "HUDDLE" | "DECISION" | "RESULTS" | "CLOSING";

export interface Idea {
  id: string;
  name: string;
  emoji: string;
  pitch: string;
  keywords: { en: string; vi: string }[];
  sellingPoints: string[];
}
export type IdeaPublic = Pick<Idea, "id" | "name" | "emoji" | "pitch">;

export interface Company {
  groupId: GroupId;
  ideaId: string;
  /** Furthest step visited, for host/projector progress. */
  prepStep: 1 | 2 | 3 | 4;
  prepSteps: Record<PlayerId, Company["prepStep"]>;
  rerolled: boolean;
  /** The group has locked its idea by voting or using its one change. */
  rerollLocked: boolean;
  ideaLockVotes: PlayerId[];
  price: number | null;
  /** True when Prepare ended without a price and the midpoint was filled in. */
  priceAuto?: boolean;
  /** Set only when the company gives its one discount. */
  originalPrice?: number;
  discounted: boolean;
  /** Current members, in part order. */
  members: PlayerId[];
  /** Left or kicked; their asked marks still count. */
  formerMembers: PlayerId[];
  /** Members at Prepare: quantity cap. */
  startMembers: number;
  /** Fixed at Prepare: moneyPerMember × startMembers. */
  startWallet: number;
  parts: Record<PlayerId, PartId[]>;
  /** Filled blanks, per part. */
  scripts: Partial<Record<PartId, string[]>>;
  wallet: number;
  help: boolean;
}

export interface Purchase {
  buyer: GroupId;
  seller: GroupId;
  quantity: number;
  price: number;
}

export interface SharkTankShared {
  stage: Stage;
  timer: TimerState;
  order: GroupId[];
  presenterIndex: number;
  presented: GroupId[];
  companies: Company[];
  /** Keyed by presenter. */
  asked: Record<GroupId, PlayerId[]>;
  /** Current pitch, keyed by buyer. */
  votes: Record<GroupId, Record<PlayerId, number>>;
  /** Buyers locked this pitch. */
  locked: GroupId[];
  purchases: Purchase[];
  announcers: Record<GroupId, PlayerId>;
  closing: { order: PlayerId[]; index: number } | null;
  left: PlayerId[];
}

export interface CompanyView {
  groupId: GroupId;
  prepStep: 1 | 2 | 3 | 4;
  members: PlayerId[];
  discounted: boolean;
  voted: boolean;
  /** Host and own group only. */
  rerollAllowed: boolean | null;
  /** Host and own group only. */
  ideaLocked: boolean | null;
  ideaLockVotes: PlayerId[] | null;
  /** Fixed at Prepare; host and own group only. */
  startMembers: number | null;
  idea: Idea | IdeaPublic | null;
  price: number | null;
  priceAuto: boolean | null;
  originalPrice: number | null;
  parts: Record<PlayerId, PartId[]> | null;
  help: boolean | null;
  scripts: Partial<Record<PartId, string[]>> | null;
  wallet: number | null;
  minSpendLeft: number | null;
  votes: Record<PlayerId, number> | null;
  eligible: boolean | null;
  purchases: Purchase[] | null;
  revenue: number | null;
}

export interface SharkTankView {
  stage: Stage;
  /** Host-only guard for stage changes. */
  presenterIndex: number | null;
  minPrice: number;
  maxPrice: number;
  timer: TimerState;
  order: GroupId[] | null;
  presenter: GroupId | null;
  companies: CompanyView[];
  asked: PlayerId[] | null;
  announcers: Record<GroupId, PlayerId> | null;
  myDecision: boolean | null;
  results: Results | null;
  closing: { order: PlayerId[]; index: number } | null;
}
