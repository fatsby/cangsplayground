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

/** Statements and findings of the time/alibi family. `f1` = before nine, `f2` = during dinner. */
const CARDS: CardSpec[] = [
  ...commonInitialCards(
    { kind: "testimony", source: "s2", claims: [S1] },
    {
      intro: "{s2} spoke to the police on the night of the crime.",
      note: "{s2} gave no reason for this.",
    },
  ),
  {
    id: "cs1",
    kind: "verified",
    source: "watch",
    claims: [fact("f1")],
    intro: "The police looked at the victim's watch.",
    note: "The glass of the watch was broken.",
  },
  {
    id: "cs2",
    kind: "verified",
    source: "s4",
    claims: [fact("f1")],
    intro: "{s4} told the police about the evening.",
    note: "Two other guests agree with {s4}.",
  },
  {
    id: "cs3",
    kind: "verified",
    source: "s2",
    claims: [fact("f1")],
    intro: "{s2} could not explain the accusation.",
    note: "{s2} admits that the hall clock stopped at eight forty.",
  },
  {
    id: "cw1",
    kind: "verified",
    source: "s4",
    claims: [not(W1)],
    intro: "{s4} also opened the locked cabinet for the police.",
    note: "{w1} was inside all night.",
  },
  {
    id: "cw2",
    kind: "verified",
    source: "cook",
    claims: [not(W1)],
    intro: "The cook talked to the police about the kitchen.",
    note: "{w1} never left its place.",
  },
  {
    id: "cw3",
    kind: "verified",
    source: "cabinet",
    claims: [not(W1)],
    intro: "The police checked the locked cabinet.",
    note: "The lock was not broken.",
  },
  {
    id: "cr1",
    kind: "verified",
    source: "cook",
    claims: [fact("f2")],
    intro: "The cook served dinner that night.",
    note: "The cook remembers the time of each course.",
  },
  {
    id: "cr2",
    kind: "verified",
    source: "log",
    claims: [fact("f2")],
    intro: "The police read the dinner log.",
    note: "The log shows the time of each course.",
  },
  {
    id: "cr3",
    kind: "verified",
    source: "s2",
    claims: [fact("f2")],
    intro: "{s2} also talked about the dinner.",
    note: "{s2} says the soup was still on the table.",
  },
];

const BASE_ACTIONS: ActionSpec[] = [
  {
    id: "a1",
    kind: "inspect",
    target: "watch",
    prompt: "Check the victim's watch.",
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
    target: "cook",
    prompt: "Ask the cook about the kitchen and the dinner.",
    yields: ["cw2", "cr1"],
  },
  { id: "a4", kind: "inspect", target: "log", prompt: "Read the dinner log.", yields: ["cr2"] },
];

const SHARED: FamilyBase = {
  familyId: "alibi",
  factIds: ["f1", "f2"],
  truthFacts: { f1: true, f2: true },
  publicConstraint: all(any(not(fact("f1")), not(S1)), any(not(fact("f2")), not(R3))),
  ruleText: [
    "{s1} arrived at the {house} at ten past nine. So if the crime happened before nine o'clock, {s1} is not the guilty person.",
    "{r3} was locked during dinner. So if the crime happened during dinner, it did not happen in {r3}.",
  ],
  factClauses: {
    f1: {
      yes: "the crime happened before nine o'clock",
      no: "the crime happened after nine o'clock",
    },
    f2: { yes: "the crime happened during dinner", no: "the crime happened after dinner" },
  },
  documents: {
    ...INITIAL_DOCUMENTS,
    watch: "Victim's watch",
    cook: "The cook",
    log: "Dinner log",
    cabinet: "Locked cabinet",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: CARDS,
  reveal: {
    events: [
      "{s1} only arrived at ten past nine, so {s1} could not be there before nine.",
      "During dinner, {s3} left the table without a word.",
      "{s3} took {w2} and went to {r4}, because nobody was there.",
      "The crime happened before nine o'clock. The victim was found later at {found}.",
    ],
    explanations: {
      i4: "{s2} said that {s1} was guilty, but {s1} arrived at ten past nine, after the crime. {s2} was only repeating a rumor.",
    },
  },
};

/** The alibi/time family: facts about when it happened are combined with public timetables. */
export function alibiTemplates(): CaseTemplate[] {
  return [
    variantOf(SHARED, "window", [
      ...BASE_ACTIONS,
      {
        id: "a5",
        kind: "challenge",
        target: "s2",
        prompt: "Ask {s2} to explain the accusation.",
        needs: ["i4"],
        yields: ["cs3"],
      },
    ]),
    variantOf(SHARED, "route", [
      ...BASE_ACTIONS,
      {
        id: "a5",
        kind: "challenge",
        target: "s2",
        prompt: "Ask {s2} to explain the accusation.",
        needs: ["i4"],
        yields: ["cs3", "cr3"],
      },
      {
        id: "a6",
        kind: "inspect",
        target: "cabinet",
        prompt: "Look inside the locked cabinet.",
        after: ["a2"],
        yields: ["cw3"],
      },
    ]),
  ];
}
