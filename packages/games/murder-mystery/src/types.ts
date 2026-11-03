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

/** The full solution story, shown to everyone only after the host reveals it. */
export type CaseReveal = {
  answer: Answer;
  events: string[];
  testimonyExplanations: { cardId: string; explanation: string }[];
};
