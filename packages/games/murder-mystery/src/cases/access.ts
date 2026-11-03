import {
  all,
  any,
  fact,
  is,
  not,
  type ActionSpec,
  type CardSpec,
  type CaseTemplate,
} from "../model.js";
import { INITIAL_DOCUMENTS, commonInitialCards, variantOf, type FamilyBase } from "./shared.js";

const S1 = is("suspectId", "s1");
const R3 = is("roomId", "r3");
const W1 = is("weaponId", "w1");

const verified = (
  id: string,
  source: string,
  claims: CardSpec["claims"],
  intro: string,
  note: string,
): CardSpec => ({
  id,
  kind: "verified",
  source,
  claims,
  intro,
  note,
});

/** Rules shared by both variants: only the first suspect has a key to the third room. */
const RULES = {
  publicConstraint: all(any(not(R3), S1), any(not(fact("f1")), not(W1))),
  ruleText: [
    "{s1} is the only person with a key to {r3}. So if the crime happened in {r3}, {s1} is the guilty person.",
    "{w1} is kept in the tool cupboard. So if the tool cupboard was locked on the night of the crime, the weapon was not {w1}.",
  ],
  factClauses: {
    f1: {
      yes: "the tool cupboard was locked on the night of the crime",
      no: "the tool cupboard was open on the night of the crime",
    },
    f2: { yes: "the back door was open all evening", no: "the back door was closed all evening" },
  },
};

const STATEMENT = {
  intro: "{s2} spoke to the police on the night of the crime.",
  note: "{s2} looked nervous.",
};

/**
 * `key-transfer`: the key holder is innocent. The third room is ruled out because the key holder
 * was elsewhere, and the cupboard was locked, so the truth is the third suspect with the second
 * weapon in the fourth room. Facts: `f1` = cupboard locked, `f2` = back door open.
 */
const KEY_TRANSFER: FamilyBase = {
  familyId: "access",
  ...RULES,
  factIds: ["f1", "f2"],
  truth: { suspectId: "s3", weaponId: "w2", roomId: "r4" },
  truthFacts: { f1: true, f2: false },
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Garden camera",
    gardener: "The gardener",
    toollog: "Tool log",
    cupboard: "Tool cupboard",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards({ kind: "testimony", source: "s2", claims: [fact("f2")] }, STATEMENT),
    verified(
      "cs1",
      "camera",
      [not(S1)],
      "The police watched the video from the garden camera.",
      "The video shows {s1} in the garden for the whole evening.",
    ),
    verified(
      "cs2",
      "s4",
      [not(S1)],
      "{s4} spoke to the police about the garden.",
      "{s4} was with {s1} the whole time.",
    ),
    verified(
      "cs3",
      "s2",
      [not(S1)],
      "{s2} told the truth when the police asked again.",
      "{s2} was in the garden with {s1}.",
    ),
    verified(
      "cw1",
      "s4",
      [fact("f1")],
      "{s4} walked past the tool cupboard at eight o'clock.",
      "The cupboard was locked.",
    ),
    verified(
      "cw2",
      "gardener",
      [fact("f1")],
      "The gardener talked about the tools.",
      "The gardener locked the cupboard at six o'clock.",
    ),
    verified(
      "cw3",
      "toollog",
      [fact("f1")],
      "The police read the tool log.",
      "The last name in the log is from six o'clock.",
    ),
  ],
  reveal: {
    events: [
      "{s1} was in the garden with {s4} all evening, so {s1} could not use the key to {r3}.",
      "The tool cupboard was locked, so {w1} was not available.",
      "{s3} used {w2} in {r4}, a room that anyone can enter. The victim was found later at {found}.",
    ],
    explanations: {
      i4: "{s2} said that the back door was open all evening, but it was closed. {s2} wanted to hide that {s2} was in the garden with {s1}.",
    },
  },
};

/**
 * `door-access`: the key holder is guilty. The cupboard was open, so the first weapon was free
 * to use; the evidence clears the other suspect, weapon and room. Truth: first suspect, first
 * weapon, third room. Facts: `f1` = cupboard locked (false here), `f2` = back door open.
 */
const DOOR_ACCESS: FamilyBase = {
  familyId: "access",
  ...RULES,
  factIds: ["f1", "f2"],
  truth: { suspectId: "s1", weaponId: "w1", roomId: "r3" },
  truthFacts: { f1: false, f2: false },
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Garden camera",
    gardener: "The gardener",
    toollog: "Tool log",
    cupboard: "Tool cupboard",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards({ kind: "testimony", source: "s2", claims: [fact("f2")] }, STATEMENT),
    verified(
      "cs1",
      "camera",
      [not(is("suspectId", "s3"))],
      "The police watched the video from the garden camera.",
      "The video shows {s3} in the garden for the whole evening.",
    ),
    verified(
      "cs2",
      "s4",
      [not(is("suspectId", "s3"))],
      "{s4} spoke to the police about the garden.",
      "{s4} was with {s3} the whole time.",
    ),
    verified(
      "cs3",
      "s2",
      [not(is("suspectId", "s3"))],
      "{s2} told the truth when the police asked again.",
      "{s2} was in the garden with {s3}.",
    ),
    verified(
      "cw1",
      "s4",
      [not(is("weaponId", "w2"))],
      "{s4} also looked in the tool cupboard.",
      "{w2} was at the repair shop all week.",
    ),
    verified(
      "cw2",
      "gardener",
      [not(is("weaponId", "w2"))],
      "The gardener talked about the tools.",
      "{w2} was never in the shed that night.",
    ),
    verified(
      "cw3",
      "cupboard",
      [not(is("weaponId", "w2")), not(fact("f1"))],
      "The police checked the tool cupboard.",
      "The door of the cupboard was open.",
    ),
    verified(
      "cr1",
      "gardener",
      [not(is("roomId", "r4"))],
      "The gardener walked around the {house} at eight o'clock.",
      "The gardener saw nobody in {r4}.",
    ),
    verified(
      "cr2",
      "toollog",
      [not(is("roomId", "r4"))],
      "The police read the tool log.",
      "Nobody took a tool into {r4}.",
    ),
    verified(
      "cr3",
      "s2",
      [not(is("roomId", "r4"))],
      "{s2} also told the truth about the rooms.",
      "{s2} was in {r4} all evening and saw nothing.",
    ),
  ],
  reveal: {
    events: [
      "{s3} was in the garden with {s2} and {s4} all evening, so {s3} is not the one.",
      "The tool cupboard was open, so {w1} was free for anyone to take.",
      "{s1} had the only key to {r3}. {s1} used {w1} there. The victim was found later at {found}.",
    ],
    explanations: {
      i4: "{s2} said that the back door was open all evening, but it was closed. {s2} wanted to hide that {s2} was in the garden with {s3}.",
    },
  },
};

const KEY_ACTIONS: ActionSpec[] = [
  {
    id: "a1",
    kind: "inspect",
    target: "camera",
    prompt: "Watch the video from the garden camera.",
    yields: ["cs1"],
  },
  {
    id: "a2",
    kind: "alibi",
    target: "s4",
    prompt: "Ask {s4} where they were that evening.",
    yields: ["cs2", "cw1"],
  },
  {
    id: "a3",
    kind: "relationship",
    target: "gardener",
    prompt: "Ask the gardener about the tools.",
    yields: ["cw2"],
  },
  { id: "a4", kind: "inspect", target: "toollog", prompt: "Read the tool log.", yields: ["cw3"] },
  {
    id: "a5",
    kind: "challenge",
    target: "s2",
    prompt: "Ask {s2} about the back door.",
    needs: ["i4"],
    yields: ["cs3"],
  },
];

const DOOR_ACTIONS: ActionSpec[] = [
  {
    id: "a1",
    kind: "inspect",
    target: "camera",
    prompt: "Watch the video from the garden camera.",
    yields: ["cs1"],
  },
  {
    id: "a2",
    kind: "alibi",
    target: "s4",
    prompt: "Ask {s4} where they were that evening.",
    yields: ["cs2", "cw1"],
  },
  {
    id: "a3",
    kind: "relationship",
    target: "gardener",
    prompt: "Ask the gardener about the tools and the rooms.",
    yields: ["cw2", "cr1"],
  },
  { id: "a4", kind: "inspect", target: "toollog", prompt: "Read the tool log.", yields: ["cr2"] },
  {
    id: "a5",
    kind: "challenge",
    target: "s2",
    prompt: "Show {s2} the guest list and ask about the back door.",
    needs: ["i4", "i1"],
    yields: ["cs3", "cr3"],
  },
  {
    id: "a6",
    kind: "inspect",
    target: "cupboard",
    prompt: "Check the tool cupboard.",
    after: ["a2"],
    yields: ["cw3"],
  },
];

/** The key/access family: who can reach a room and which tools were out of reach. */
export function accessTemplates(): CaseTemplate[] {
  return [
    variantOf(KEY_TRANSFER, "key-transfer", KEY_ACTIONS),
    variantOf(DOOR_ACCESS, "door-access", DOOR_ACTIONS),
  ];
}
