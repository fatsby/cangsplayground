import { z } from "zod";
import type { GroupId, PlayerId, TimerState } from "@cangsplayground/core";

export const GAME_ID = "guess-the-character";

export const LIMITS = {
  voteSeconds: { min: 10, max: 180, step: 5 },
  turnSeconds: { min: 15, max: 600, step: 15 },
  cooldownSeconds: { min: 1, max: 60, step: 1 },
} as const;

export const configSchema = z.object({
  voteSeconds: z.number().int().min(LIMITS.voteSeconds.min).max(LIMITS.voteSeconds.max).default(30),
  turnSeconds: z
    .number()
    .int()
    .min(LIMITS.turnSeconds.min)
    .max(LIMITS.turnSeconds.max)
    .default(120),
  cooldownSeconds: z
    .number()
    .int()
    .min(LIMITS.cooldownSeconds.min)
    .max(LIMITS.cooldownSeconds.max)
    .default(5),
});
export type GuessConfig = z.infer<typeof configSchema>;

/** Longest accepted guess, in Unicode code points after trimming. */
export const GUESS_MAX = 80;

export interface Character {
  id: string;
  name: string;
  aliases: string[];
}
export interface Category {
  id: string;
  name: string;
  characterIds: string[];
}
export type CharacterFace = Pick<Character, "id" | "name">;
export interface CategoryOption {
  id: string;
  name: string;
  examples: string[];
}
export type HelpLevel = "A1" | "A2";
export type HelpRole = "question" | "answer";
export interface Phrase {
  en: string;
  vi: string;
}
export interface LanguageHelp {
  questions: Phrase[];
  answers: Phrase[];
  grammar: Phrase;
  vocabulary: Phrase[];
}

export type MatchPhase = "READY" | "CATEGORY_VOTE" | "PLAYING" | "FINISHED" | "ENDED";
export type PauseReason = "host" | "offline";
export type EndReason = "host" | "empty-group";

export interface MatchTeam {
  groupId: GroupId;
  /** Round snapshot, in this round's speaking order. Leavers are removed. */
  members: PlayerId[];
  /** Index in `members` of the next candidate speaker. */
  nextIndex: number;
  characterId: string | null;
  cooldown: TimerState;
  guessVersion: number;
}

export interface GuessMatch {
  id: string;
  phase: MatchPhase;
  phaseVersion: number;
  teams: [MatchTeam, MatchTeam];
  categoryId: string | null;
  votes: Record<PlayerId, string>;
  timer: TimerState;
  paused: boolean;
  pauseReason: PauseReason | null;
  askingTeam: 0 | 1;
  speakerId: PlayerId | null;
  turnId: number;
  /** Cached from the live roster: who asks after this turn. */
  nextSpeakerId: PlayerId | null;
  /** Cached from the live roster: connected members per team. */
  connectedCounts: [number, number];
  winnerGroupId: GroupId | null;
  endReason: EndReason | null;
}

export interface GuessShared {
  round: number;
  groups: { groupId: GroupId; members: PlayerId[] }[];
  matches: GuessMatch[];
}

export interface MatchGuard {
  round: number;
  matchId: string;
  phaseVersion: number;
}
export interface ControlGuard extends MatchGuard {
  turnId: number | null;
}

export type MatchPublicView = Pick<
  GuessMatch,
  | "id"
  | "phase"
  | "phaseVersion"
  | "categoryId"
  | "paused"
  | "pauseReason"
  | "speakerId"
  | "turnId"
  | "winnerGroupId"
  | "endReason"
  | "timer"
> & {
  groupIds: [GroupId, GroupId];
  /** Public speaking order per team (names are public in the lobby). */
  members: [PlayerId[], PlayerId[]];
  askingGroupId: GroupId | null;
  nextSpeakerId: PlayerId | null;
  connectedCounts: [number, number];
  votedCount: number;
  voterCount: number;
};

export interface MatchPrivateView {
  matchId: string;
  characters: { groupId: GroupId; character: CharacterFace | null }[];
  votes: Record<PlayerId, string> | null;
  teams: { groupId: GroupId; cooldown: TimerState; guessVersion: number }[];
}

export interface GuessView {
  round: number;
  categories: CategoryOption[];
  matches: MatchPublicView[];
  ownMatchId: string | null;
  privateMatches: MatchPrivateView[];
  myVote: string | null;
  canStart: boolean;
  canNewRound: boolean;
  /** Host only: why New round is blocked once every match is over. */
  newRoundIssue: string | null;
}
