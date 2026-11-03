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

/** Statements and findings of the exchange family. `f1` = bags swapped, `f2` = taxi late. */
const CARDS: CardSpec[] = [
  ...commonInitialCards(
    { kind: "testimony", source: "s4", claims: [fact("f2")] },
    { intro: "{s4} spoke to the police on the night of the crime.", note: "{s4} was in a hurry." },
  ),
  {
    id: "cs1",
    kind: "verified",
    source: "camera",
    claims: [not(S1)],
    intro: "The police watched the video from the hall camera.",
    note: "The video shows {s1} with {s2} all evening.",
  },
  {
    id: "cs2",
    kind: "verified",
    source: "s2",
    claims: [not(S1)],
    intro: "{s2} spoke to the police about the evening.",
    note: "{s2} was with {s1} the whole time.",
  },
  {
    id: "cs3",
    kind: "verified",
    source: "s4",
    claims: [not(S1)],
    intro: "{s4} told the police more about the evening.",
    note: "{s4} saw {s1} with {s2}.",
  },
  {
    id: "cr1",
    kind: "verified",
    source: "labels",
    claims: [fact("f1")],
    intro: "The police compared the labels on the two bags.",
    note: "The labels were on the wrong bags.",
  },
  {
    id: "cr2",
    kind: "verified",
    source: "porter",
    claims: [fact("f1")],
    intro: "The porter told the police about the bags.",
    note: "The porter put the bags on the wrong table.",
  },
  {
    id: "cr3",
    kind: "verified",
    source: "doorlog",
    claims: [fact("f1")],
    intro: "The police read the door log.",
    note: "The log says the two bags arrived together.",
  },
];

const SHARED: FamilyBase = {
  familyId: "exchange",
  factIds: ["f1", "f2"],
  truthFacts: { f1: true, f2: false },
  publicConstraint: all(any(not(W1), S1), any(not(fact("f1")), not(R3))),
  ruleText: [
    "{w1} belongs to {s1}. So if the weapon was {w1}, {s1} is the guilty person.",
    "The key to {r3} is kept in a bag at the door. If the two bags were swapped at the door, nobody could open {r3}, so the crime did not happen in {r3}.",
  ],
  factClauses: {
    f1: {
      yes: "the two bags were swapped at the door",
      no: "the two bags were not swapped at the door",
    },
    f2: { yes: "the taxi arrived late", no: "the taxi arrived on time" },
  },
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Hall camera",
    labels: "Bag labels",
    porter: "The porter",
    doorlog: "Door log",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: CARDS,
  reveal: {
    events: [
      "{s1} was with {s2} all evening, so {s1} could not use {w1}.",
      "At the door, two bags were swapped by mistake. Because of the swap, nobody could open {r3}.",
      "{s3} used {w2} in {r4}. The victim was found later at {found}.",
    ],
    explanations: {
      i4: "{s4} said that the taxi arrived late, but it came on time. {s4} was confused about the time because of the swapped bags.",
    },
  },
};

const OPENING_ACTIONS: ActionSpec[] = [
  {
    id: "a1",
    kind: "inspect",
    target: "camera",
    prompt: "Watch the video from the hall camera.",
    yields: ["cs1"],
  },
  {
    id: "a2",
    kind: "alibi",
    target: "s2",
    prompt: "Ask {s2} where they were that evening.",
    yields: ["cs2"],
  },
  {
    id: "a3",
    kind: "inspect",
    target: "labels",
    prompt: "Compare the labels on the two bags.",
    yields: ["cr1"],
  },
  {
    id: "a4",
    kind: "relationship",
    target: "porter",
    prompt: "Ask the porter about the bags.",
    yields: ["cr2"],
  },
  {
    id: "a5",
    kind: "challenge",
    target: "s4",
    prompt: "Ask {s4} about the taxi.",
    needs: ["i4"],
    yields: ["cs3"],
  },
];

/** The exchange family: swapped objects and mistaken identity of the evidence. */
export function exchangeTemplates(): CaseTemplate[] {
  return [
    variantOf(SHARED, "swapped-items", OPENING_ACTIONS),
    variantOf(SHARED, "swapped-recipients", [
      ...OPENING_ACTIONS,
      {
        id: "a6",
        kind: "inspect",
        target: "doorlog",
        prompt: "Read the door log.",
        after: ["a4"],
        yields: ["cr3"],
      },
    ]),
  ];
}
