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

/**
 * `window`: the crime happened BEFORE nine and DURING dinner. The first suspect and the third
 * room are cleared by public timetables; the truth is the other member of each pair.
 * Facts: `f1` = before nine, `f2` = during dinner.
 */
const WINDOW: FamilyBase = {
  familyId: "alibi",
  factIds: ["f1", "f2"],
  truth: { suspectId: "s3", weaponId: "w2", roomId: "r4" },
  truthFacts: { f1: true, f2: true },
  publicConstraint: all(
    any(not(fact("f1")), not(is("suspectId", "s1"))),
    any(not(fact("f2")), not(is("roomId", "r3"))),
  ),
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
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards(
      { kind: "testimony", source: "s2", claims: [is("suspectId", "s1")] },
      {
        intro: "{s2} spoke to the police on the night of the crime.",
        note: "{s2} gave no reason for this.",
      },
    ),
    verified(
      "cs1",
      "watch",
      [fact("f1")],
      "The police looked at the victim's watch.",
      "The glass of the watch was broken.",
    ),
    verified(
      "cs2",
      "s4",
      [fact("f1")],
      "{s4} told the police about the evening.",
      "Two other guests agree with {s4}.",
    ),
    verified(
      "cs3",
      "s2",
      [fact("f1")],
      "{s2} could not explain the accusation.",
      "{s2} admits that the hall clock stopped at eight forty.",
    ),
    verified(
      "cw1",
      "s4",
      [not(is("weaponId", "w1"))],
      "{s4} also opened the locked cabinet for the police.",
      "{w1} was inside all night.",
    ),
    verified(
      "cw2",
      "cook",
      [not(is("weaponId", "w1"))],
      "The cook talked to the police about the kitchen.",
      "{w1} never left its place.",
    ),
    verified(
      "cr1",
      "cook",
      [fact("f2")],
      "The cook served dinner that night.",
      "The cook remembers the time of each course.",
    ),
    verified(
      "cr2",
      "log",
      [fact("f2")],
      "The police read the dinner log.",
      "The log shows the time of each course.",
    ),
  ],
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

/**
 * `route`: the crime happened AFTER nine and AFTER dinner. Here the third suspect and the fourth
 * room are cleared by the timetables, so the truth is the first suspect, first weapon and third
 * room, the opposite members of each pair from `window`.
 * Facts: `f1` = after nine, `f2` = after dinner.
 */
const ROUTE: FamilyBase = {
  familyId: "alibi",
  factIds: ["f1", "f2"],
  truth: { suspectId: "s1", weaponId: "w1", roomId: "r3" },
  truthFacts: { f1: true, f2: true },
  publicConstraint: all(
    any(not(fact("f1")), not(is("suspectId", "s3"))),
    any(not(fact("f2")), not(is("roomId", "r4"))),
  ),
  ruleText: [
    "{s3} left the {house} at a quarter to nine. So if the crime happened after nine o'clock, {s3} is not the guilty person.",
    "{r4} was locked after dinner. So if the crime happened after dinner, it did not happen in {r4}.",
  ],
  factClauses: {
    f1: {
      yes: "the crime happened after nine o'clock",
      no: "the crime happened before nine o'clock",
    },
    f2: { yes: "the crime happened after dinner", no: "the crime happened during dinner" },
  },
  documents: {
    ...INITIAL_DOCUMENTS,
    clock: "Hall clock",
    cook: "The cook",
    log: "Dinner log",
    cabinet: "Locked cabinet",
  },
  initialCardIds: ["i1", "i2", "i3", "i4"],
  cards: [
    ...commonInitialCards(
      { kind: "testimony", source: "s2", claims: [is("suspectId", "s3")] },
      {
        intro: "{s2} spoke to the police on the night of the crime.",
        note: "{s2} looked sure of the answer.",
      },
    ),
    verified(
      "cs1",
      "clock",
      [fact("f1")],
      "The police checked the hall clock.",
      "The clock stopped at ten past nine.",
    ),
    verified(
      "cs2",
      "s4",
      [fact("f1")],
      "{s4} told the police about the evening.",
      "{s4} heard the clock strike nine before it happened.",
    ),
    verified(
      "cs3",
      "s2",
      [fact("f1")],
      "{s2} could not explain the accusation.",
      "{s2} admits that the hall clock stopped at ten past nine.",
    ),
    verified(
      "cw1",
      "s4",
      [not(is("weaponId", "w2"))],
      "{s4} also opened the locked cabinet for the police.",
      "{w2} was inside all night.",
    ),
    verified(
      "cw2",
      "cook",
      [not(is("weaponId", "w2"))],
      "The cook talked to the police about the kitchen.",
      "{w2} never left its place.",
    ),
    verified(
      "cw3",
      "cabinet",
      [not(is("weaponId", "w2"))],
      "The police checked the locked cabinet.",
      "The lock was not broken.",
    ),
    verified(
      "cr1",
      "cook",
      [fact("f2")],
      "The cook served dinner that night.",
      "The cook says dessert was already on the table.",
    ),
    verified(
      "cr2",
      "log",
      [fact("f2")],
      "The police read the dinner log.",
      "The last course is written at nine o'clock.",
    ),
    verified(
      "cr3",
      "s2",
      [fact("f2")],
      "{s2} also talked about the dinner.",
      "{s2} says the coffee was already cold.",
    ),
  ],
  reveal: {
    events: [
      "{s3} left the {house} at a quarter to nine, so {s3} could not be there after nine.",
      "After dinner, {s1} went to {r3} without a word.",
      "{s1} took {w1} and used it there, because nobody else was around.",
      "The crime happened after nine o'clock. The victim was found later at {found}.",
    ],
    explanations: {
      i4: "{s2} said that {s3} was guilty, but {s3} left the {house} at a quarter to nine, before the crime. {s2} was only repeating a rumor.",
    },
  },
};

const WINDOW_ACTIONS: ActionSpec[] = [
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
  {
    id: "a5",
    kind: "challenge",
    target: "s2",
    prompt: "Ask {s2} to explain the accusation.",
    needs: ["i4"],
    yields: ["cs3"],
  },
];

const ROUTE_ACTIONS: ActionSpec[] = [
  { id: "a1", kind: "inspect", target: "clock", prompt: "Check the hall clock.", yields: ["cs1"] },
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
];

/** The alibi/time family: facts about when it happened are combined with public timetables. */
export function alibiTemplates(): CaseTemplate[] {
  return [variantOf(WINDOW, "window", WINDOW_ACTIONS), variantOf(ROUTE, "route", ROUTE_ACTIONS)];
}
