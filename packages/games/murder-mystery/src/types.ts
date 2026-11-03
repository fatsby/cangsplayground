/**
 * Public content faces: what players, host and projector are allowed to read about a case.
 * These carry no logic, seed or hidden truth; `Answer` is imported type-only for the reveal.
 */
import type { Answer } from "./model.js";

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
