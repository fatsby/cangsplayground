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
const W1 = is("weaponId", "w1");
const R3 = is("roomId", "r3");

/** Statements and findings of the key family. `f1` = tool cupboard locked, `f2` = back door open. */
const CARDS: CardSpec[] = [
  ...commonInitialCards(
    { kind: "testimony", source: "s2", claims: [fact("f2")] },
    { intro: "{s2} spoke to the police on the night of the crime.", note: "{s2} looked nervous." },
  ),
  {
    id: "cs1",
    kind: "verified",
    source: "camera",
    claims: [not(S1)],
    intro: "The police watched the video from the garden camera.",
    note: "The video shows {s1} in the garden for the whole evening.",
  },
  {
    id: "cs2",
    kind: "verified",
    source: "s4",
    claims: [not(S1)],
    intro: "{s4} spoke to the police about the garden.",
    note: "{s4} was with {s1} the whole time.",
  },
  {
    id: "cs3",
    kind: "verified",
    source: "s2",
    claims: [not(S1)],
    intro: "{s2} told the truth when the police asked again.",
    note: "{s2} was in the garden with {s1}.",
  },
  {
    id: "cw1",
    kind: "verified",
    source: "s4",
    claims: [fact("f1")],
    intro: "{s4} walked past the tool cupboard at eight o'clock.",
    note: "The cupboard was locked.",
  },
  {
    id: "cw2",
    kind: "verified",
    source: "gardener",
    claims: [fact("f1")],
    intro: "The gardener talked about the tools.",
    note: "The gardener locked the cupboard at six o'clock.",
  },
  {
    id: "cw3",
    kind: "verified",
    source: "toollog",
    claims: [fact("f1")],
    intro: "The police read the tool log.",
    note: "The last name in the log is from six o'clock.",
  },
  {
    id: "cw4",
    kind: "verified",
    source: "cupboard",
    claims: [fact("f1")],
    intro: "The police checked the tool cupboard.",
    note: "The lock was not broken.",
  },
];

const SHARED: FamilyBase = {
  familyId: "access",
  factIds: ["f1", "f2"],
  truthFacts: { f1: true, f2: false },
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
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Garden camera",
    gardener: "The gardener",
    toollog: "Tool log",
    cupboard: "Tool cupboard",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: CARDS,
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

const OPENING_ACTIONS: ActionSpec[] = [
  {
    id: "a1",
    kind: "inspect",
    target: "camera",
    prompt: "Watch the video from the garden camera.",
    yields: ["cs1"],
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

/** The key/access family: who can reach a room and which tools were out of reach. */
export function accessTemplates(): CaseTemplate[] {
  return [
    variantOf(SHARED, "key-transfer", [
      OPENING_ACTIONS[0]!,
      {
        id: "a2",
        kind: "alibi",
        target: "s4",
        prompt: "Ask {s4} where they were that evening.",
        yields: ["cs2", "cw1"],
      },
      OPENING_ACTIONS[1]!,
      OPENING_ACTIONS[2]!,
      OPENING_ACTIONS[3]!,
    ]),
    variantOf(SHARED, "door-access", [
      OPENING_ACTIONS[0]!,
      {
        id: "a2",
        kind: "alibi",
        target: "s4",
        prompt: "Ask {s4} where they were that evening.",
        yields: ["cs2"],
      },
      OPENING_ACTIONS[1]!,
      OPENING_ACTIONS[2]!,
      OPENING_ACTIONS[3]!,
      {
        id: "a6",
        kind: "inspect",
        target: "cupboard",
        prompt: "Check the tool cupboard.",
        after: ["a3"],
        yields: ["cw4"],
      },
    ]),
  ];
}
