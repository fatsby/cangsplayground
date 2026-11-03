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

/** Rules shared by both variants: the first weapon belongs to the first suspect; swapped bags close room three. */
const RULES = {
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
};

const STATEMENT = {
  intro: "{s4} spoke to the police on the night of the crime.",
  note: "{s4} was in a hurry.",
};

const EXPLANATION =
  "{s4} said that the taxi arrived late, but it came on time. {s4} was confused about the time because of the swapped bags.";

/**
 * `swapped-items`: the weapon's owner is innocent. Truth: third suspect, second weapon, fourth
 * room. Facts: `f1` = bags swapped, `f2` = taxi late.
 */
const SWAPPED_ITEMS: FamilyBase = {
  familyId: "exchange",
  ...RULES,
  factIds: ["f1", "f2"],
  truth: { suspectId: "s3", weaponId: "w2", roomId: "r4" },
  truthFacts: { f1: true, f2: false },
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Hall camera",
    labels: "Bag labels",
    porter: "The porter",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards({ kind: "testimony", source: "s4", claims: [fact("f2")] }, STATEMENT),
    verified(
      "cs1",
      "camera",
      [not(S1)],
      "The police watched the video from the hall camera.",
      "The video shows {s1} with {s2} all evening.",
    ),
    verified(
      "cs2",
      "s2",
      [not(S1)],
      "{s2} spoke to the police about the evening.",
      "{s2} was with {s1} the whole time.",
    ),
    verified(
      "cs3",
      "s4",
      [not(S1)],
      "{s4} told the police more about the evening.",
      "{s4} saw {s1} with {s2}.",
    ),
    verified(
      "cr1",
      "labels",
      [fact("f1")],
      "The police compared the labels on the two bags.",
      "The labels were on the wrong bags.",
    ),
    verified(
      "cr2",
      "porter",
      [fact("f1")],
      "The porter told the police about the bags.",
      "The porter put the bags on the wrong table.",
    ),
  ],
  reveal: {
    events: [
      "{s1} was with {s2} all evening, so {s1} could not use {w1}.",
      "At the door, two bags were swapped by mistake. Because of the swap, nobody could open {r3}.",
      "{s3} used {w2} in {r4}. The victim was found later at {found}.",
    ],
    explanations: { i4: EXPLANATION },
  },
};

/**
 * `swapped-recipients`: the weapon's owner is guilty. The evidence clears the other suspect and
 * the other weapon, and the swapped bags rule out room three. Truth: first suspect, first
 * weapon, fourth room. Facts: `f1` = bags swapped, `f2` = taxi late.
 */
const SWAPPED_RECIPIENTS: FamilyBase = {
  familyId: "exchange",
  ...RULES,
  factIds: ["f1", "f2"],
  truth: { suspectId: "s1", weaponId: "w1", roomId: "r4" },
  truthFacts: { f1: true, f2: false },
  documents: {
    ...INITIAL_DOCUMENTS,
    camera: "Hall camera",
    labels: "Bag labels",
    porter: "The porter",
    baggage: "Baggage room",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards({ kind: "testimony", source: "s4", claims: [fact("f2")] }, STATEMENT),
    verified(
      "cs1",
      "camera",
      [not(is("suspectId", "s3"))],
      "The police watched the video from the hall camera.",
      "The video shows {s3} with {s2} all evening.",
    ),
    verified(
      "cs2",
      "s2",
      [not(is("suspectId", "s3"))],
      "{s2} spoke to the police about the evening.",
      "{s2} was with {s3} the whole time.",
    ),
    verified(
      "cs3",
      "s4",
      [not(is("suspectId", "s3"))],
      "{s4} told the police more about the evening.",
      "{s4} saw {s3} with {s2}.",
    ),
    verified(
      "cw1",
      "s2",
      [not(is("weaponId", "w2"))],
      "{s2} also looked in the luggage room.",
      "{w2} was locked in a box all evening.",
    ),
    verified(
      "cw2",
      "porter",
      [not(is("weaponId", "w2"))],
      "The porter told the police about the luggage.",
      "{w2} never left the baggage room.",
    ),
    verified(
      "cw3",
      "baggage",
      [not(is("weaponId", "w2"))],
      "The police checked the baggage room.",
      "{w2} was still on its shelf.",
    ),
    verified(
      "cr1",
      "porter",
      [fact("f1")],
      "The porter told the police about the bags.",
      "The porter put the bags on the wrong table.",
    ),
    verified(
      "cr2",
      "labels",
      [fact("f1")],
      "The police compared the labels on the two bags.",
      "The labels were on the wrong bags.",
    ),
    verified(
      "cr3",
      "s4",
      [fact("f1")],
      "{s4} told the police more about the door.",
      "{s4} saw the two bags change places.",
    ),
  ],
  reveal: {
    events: [
      "{s3} was with {s2} all evening, so {s3} is not the one.",
      "At the door, two bags were swapped by mistake. Because of the swap, nobody could open {r3}.",
      "{w1} belongs to {s1}. {s1} used {w1} in {r4}. The victim was found later at {found}.",
    ],
    explanations: { i4: EXPLANATION },
  },
};

const ITEMS_ACTIONS: ActionSpec[] = [
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

const RECIPIENT_ACTIONS: ActionSpec[] = [
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
    yields: ["cs2", "cw1"],
  },
  {
    id: "a3",
    kind: "relationship",
    target: "porter",
    prompt: "Ask the porter about the bags and the luggage.",
    yields: ["cw2", "cr1"],
  },
  {
    id: "a4",
    kind: "inspect",
    target: "labels",
    prompt: "Compare the labels on the two bags.",
    yields: ["cr2"],
  },
  {
    id: "a5",
    kind: "challenge",
    target: "s4",
    prompt: "Show {s4} the guest list and ask about the taxi.",
    needs: ["i4", "i1"],
    yields: ["cs3", "cr3"],
  },
  {
    id: "a6",
    kind: "inspect",
    target: "baggage",
    prompt: "Check the baggage room.",
    after: ["a2"],
    yields: ["cw3"],
  },
];

/** The exchange family: swapped objects and mistaken identity of the evidence. */
export function exchangeTemplates(): CaseTemplate[] {
  return [
    variantOf(SWAPPED_ITEMS, "swapped-items", ITEMS_ACTIONS),
    variantOf(SWAPPED_RECIPIENTS, "swapped-recipients", RECIPIENT_ACTIONS),
  ];
}
