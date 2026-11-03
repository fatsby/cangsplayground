/**
 * Public content faces: what players, host and projector are allowed to read about a case.
 * These carry no logic, seed or hidden truth; `Answer` is imported type-only for the reveal.
 */
import type { GroupId, PlayerId } from "@cangsplayground/core";
import type { Answer, CompiledCase, Field } from "./model.js";

export type { MurderConfig } from "./config.js";

/** A suspect, weapon or room as shown to people: opaque id, display name and a neutral blurb. */
export type EntityFace = { id: string; name: string; description: string };

/** The public case file shared before any clue is read. */
export type CaseBriefing = {
  title: string;
  opening: string;
  victim: EntityFace;
  /** Where the body was found, which may differ from where the crime happened. */
  bodyFoundAt: string;
  suspects: EntityFace[];
  weapons: EntityFace[];
  rooms: EntityFace[];
};

/** A clue card as rendered: 2-4 B1 sentences plus vocabulary help. */
export type ClueFace = {
  id: string;
  sourceLabel: string;
  sourceKind: "testimony" | "verified";
  body: string;
  vocabulary: { en: string; vi: string }[];
};

/** Authored visual scenes the projector intro can draw; every scene works with every case. */
export type SceneId = "manor-night" | "hotel-night";

/** Public kind of place where the body was found; may differ from the crime room. */
export type FoundPlaceKind = "garden-path" | "service-corridor" | "courtyard";

/** Window/roof silhouette drawn for a room on the intro stage. */
export type RoomShape = "arched" | "square" | "low" | "glasshouse" | "round";

/** Identifying accessory drawn on a suspect silhouette. */
export type SuspectBadge = "stethoscope" | "bowtie" | "long-hair" | "hat" | "apron" | "glasses";

/** Cartoon appearance of the victim figure. */
export type VictimLook = {
  hair: "white" | "grey" | "dark" | "bald";
  coat: "indigo" | "green" | "burgundy" | "charcoal";
  accessory: "bowtie" | "scarf" | "glasses" | "hat" | "none";
};

/** Subtitles of the four intro beats. Written to imply no method of harm. */
export type IntroCaptions = { setting: string; walk: string; blackout: string; found: string };

/**
 * Everything the projector intro needs beyond the public {@link CaseBriefing}. It is built from
 * the briefing and a random stream only, so it can never encode the answer, family or seed.
 * `roomShapes` is keyed by exactly the four briefing room ids and `suspectBadges` by exactly the
 * four briefing suspect ids.
 */
export type IntroDescriptor = {
  sceneId: SceneId;
  victimLook: VictimLook;
  foundPlace: FoundPlaceKind;
  /** Display time such as `10:20 p.m.`; always after the case timeline. */
  discoveredAt: string;
  roomShapes: Record<string, RoomShape>;
  suspectBadges: Record<string, SuspectBadge>;
  captions: IntroCaptions;
};

/** The full solution story, shown to everyone only after the host reveals it. */
export type CaseReveal = {
  answer: Answer;
  events: string[];
  testimonyExplanations: { cardId: string; explanation: string }[];
};

/** Phases of one case. Only INTRO, BRIEFING, SHARING, INVESTIGATION and CONCLUSION run a clock. */
export type Phase =
  | "READY"
  | "INTRO"
  | "BRIEFING"
  | "SHARING"
  | "INVESTIGATION"
  | "CONCLUSION"
  | "AWAITING_REVEAL"
  | "REVEALED";

/**
 * The shared class clock of the current phase. Running: `endsAt` is set. Paused: `remainingMs`
 * is set. Both are null when the phase has no clock. `durationMs` is the phase length including
 * extensions, for progress rings.
 */
export type Clock = { endsAt: number | null; remainingMs: number | null; durationMs: number };

/** Evidence cards chosen for each answer field; at most two per field. */
export type ProofSelection = Record<Field, string[]>;

/** A team's accusation: the three answers and their supporting evidence. */
export type Conclusion = {
  suspectId: string | null;
  weaponId: string | null;
  roomId: string | null;
  evidence: ProofSelection;
};

/** One team's private progress through the shared case. */
export type TeamState = {
  groupId: GroupId;
  /** Members frozen when the case was prepared. */
  members: PlayerId[];
  connected: PlayerId[];
  /** Always four entries: who leads each of the four investigations, then submits. */
  leadOrder: PlayerId[];
  /** Which member holds every card the team has discovered, including transferred ones. */
  owners: Record<string, PlayerId>;
  history: { round: number; actionId: string; recipientId: PlayerId }[];
  draft: Conclusion;
  draftVersion: number;
  submission: Conclusion | null;
  active: boolean;
};

/** All shared state of one case. Server-only: it carries the compiled case and its truth. */
export type MurderShared = {
  caseNumber: number;
  phase: Phase;
  phaseVersion: number;
  /** 0 before investigation, 1-4 during it, then retained. */
  investigationRound: number;
  paused: boolean;
  clock: Clock;
  /** Server time of the host's Reveal; null until then. */
  revealedAt: number | null;
  caseData: CompiledCase;
  teams: TeamState[];
};

/** Points a team earned: 3 culprit, 2 weapon, 2 room, plus 1 per valid evidence selection. */
export type ScoreBreakdown = {
  suspect: number;
  weapon: number;
  room: number;
  evidence: Record<Field, number>;
  total: number;
};

/** Binds a command to the case and phase it was issued in, so late commands are rejected. */
export type PhaseGuard = { caseNumber: number; phaseVersion: number };

/** Registry id of the game. */
export const GAME_ID = "murder-mystery";

/** One selectable investigation, with labels only: no predicates, results or counts. */
export type ActionOption = {
  id: string;
  kind: "alibi" | "relationship" | "inspect" | "challenge";
  targetId: string;
  targetLabel: string;
  /** Sample English question or instruction for the team to say. */
  prompt: string;
  /** Cards a challenge uses, by source label only (never the card text). */
  evidence: { id: string; label: string }[];
};

/**
 * What one device may see. Built field by field (never by spreading state) so nothing private
 * can leak: no seed, logic, worlds, answer or unrevealed result.
 */
export type MurderView = PhaseGuard & {
  phase: Phase;
  paused: boolean;
  clock: Clock;
  investigationRound: number;
  /** Host from READY, projector from INTRO, players from BRIEFING; null before. */
  briefing: CaseBriefing | null;
  /** Host and projector only, from INTRO; players never receive it. */
  intro: IntroDescriptor | null;
  introMs: number;
  /** Server time of Reveal once REVEALED; null before. */
  revealStartedAt: number | null;
  progress: { groupId: GroupId; active: boolean; acted: boolean; submitted: boolean }[];
  ownTeam: null | {
    groupId: GroupId;
    members: PlayerId[];
    connected: PlayerId[];
    leadId: PlayerId | null;
    submitterId: PlayerId | null;
    options: ActionOption[];
    history: { round: number; label: string }[];
    myCards: ClueFace[];
    sharedCards: ClueFace[] | null;
    draft: Conclusion | null;
    draftVersion: number;
    submission: Conclusion | null;
    canInvestigate: boolean;
    canEdit: boolean;
    canSubmit: boolean;
  };
  hostDetails: null | {
    solution: CaseReveal;
    cards: ClueFace[];
    teams: {
      groupId: GroupId;
      members: PlayerId[];
      connected: PlayerId[];
      leadOrder: PlayerId[];
      owners: Record<string, PlayerId>;
      draft: Conclusion;
      submission: Conclusion | null;
    }[];
  };
  reveal: CaseReveal | null;
  results: { groupId: GroupId; rank: number; score: ScoreBreakdown }[] | null;
};
