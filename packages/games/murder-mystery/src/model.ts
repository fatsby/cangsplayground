/**
 * Server-only logical model of one murder case: the finite universe of "worlds", the
 * expressions evaluated over them, the clue cards and the investigation graph.
 *
 * Nothing in this file may be imported by browser code: it describes the hidden truth.
 * Public presentation types live in `types.ts` and import `Answer`/`Field` type-only.
 */

import type {
  CaseBriefing,
  CaseReveal,
  ClueFace,
  FoundPlaceKind,
  IntroCaptions,
  IntroDescriptor,
  RoomShape,
  SceneId,
  SuspectBadge,
  VictimLook,
} from "./types.js";

/** The three-part solution of a case. */
export type Answer = { suspectId: string; weaponId: string; roomId: string };

/** One of the three answer fields. */
export type Field = keyof Answer;

/**
 * A boolean expression over one {@link World}. `fact` reads a secondary boolean secret,
 * `answer` tests one answer field against an id, and `all`/`any` over no items are true/false.
 */
export type Expr =
  | { kind: "fact"; id: string }
  | { kind: "answer"; field: Field; id: string }
  | { kind: "not"; expr: Expr }
  | { kind: "all" | "any"; items: Expr[] };

/** The closed vocabulary a case reasons over. */
export type WorldDomains = {
  suspectIds: string[];
  weaponIds: string[];
  roomIds: string[];
  /** Independent boolean secrets; at most {@link MAX_FACTS}. */
  factIds: string[];
};

/** One complete assignment of the answer plus every secondary boolean fact. */
export type World = { id: string; answer: Answer; facts: Record<string, boolean> };

/**
 * A clue. `testimony` is an unverified statement and constrains nothing; `verified` is a
 * confirmed finding whose `constraint` is exactly the conjunction of its `claims`.
 */
export type LogicalCard = {
  id: string;
  sourceKind: "testimony" | "verified";
  claims: Expr[];
  constraint: Expr | null;
  sourceId: string;
};

/** The four kinds of investigation a team can choose. */
export type InvestigationKind = "alibi" | "relationship" | "inspect" | "challenge";

/** One selectable investigation and what it needs and yields. */
export type Investigation = {
  id: string;
  kind: InvestigationKind;
  targetId: string;
  prompt: string;
  requiredCardIds: string[];
  requiredActionIds: string[];
  resultCardIds: string[];
};

/** A complete authored logical configuration. */
export type CaseLogic = {
  domains: WorldDomains;
  worlds: World[];
  actualWorldId: string;
  publicConstraint: Expr;
  initialCardIds: string[];
  cards: LogicalCard[];
  actions: Investigation[];
};

/** Outcome of {@link validateCase}. */
export type ValidationReport = { ok: boolean; issues: string[]; terminalPaths: number };

/**
 * One authored clue before names are bound. `source` is a suspect slot (`s1`..`s4`) or a key of
 * the template's `documents`; text is composed as `intro` + one sentence per claim + `note`.
 */
export type CardSpec = {
  id: string;
  kind: "testimony" | "verified";
  source: string;
  claims: Expr[];
  intro: string;
  note?: string;
};

/** One authored investigation before binding; `needs` are cards, `after` are actions. */
export type ActionSpec = {
  id: string;
  kind: InvestigationKind;
  target: string;
  prompt: string;
  yields: string[];
  needs?: string[];
  after?: string[];
};

/** A spoken clause for a boolean fact being true (`yes`) or false (`no`). */
export type FactClause = { yes: string; no: string };

/**
 * A bounded logical configuration plus the annotated text that tells it. Slots `s1`..`s4`,
 * `w1`..`w3`, `r1`..`r4` stand for suspects, weapons and rooms; the truth is always
 * `s3`/`w2`/`r4` and later bound to random entities. Placeholders like `{s1}` in any text are
 * replaced by the entity's display name.
 */
export type CaseTemplate = {
  familyId: "alibi" | "access" | "exchange";
  variantId: string;
  factIds: string[];
  /**
   * The true answer as slots. It varies between templates (a suspect named in a house rule is
   * guilty in some and innocent in others) so position and rule text never reveal the answer.
   */
  truth: Answer;
  /** Truth value of every fact in the true world. */
  truthFacts: Record<string, boolean>;
  publicConstraint: Expr;
  /** Sentences that tell the public rules to everyone. */
  ruleText: string[];
  factClauses: Record<string, FactClause>;
  /** Evidence documents that can be a card source or an investigation target (key -> label). */
  documents: Record<string, string>;
  initialCardIds: string[];
  cards: CardSpec[];
  actions: ActionSpec[];
  reveal: { events: string[]; explanations: Record<string, string> };
};

/** Server-only scene preset: the pools and caption templates one intro scene draws from. */
export type ScenePreset = {
  id: SceneId;
  /** The building as a noun for case text: `house` or `hotel`. Fills `{house}`. */
  venue: string;
  titles: string[];
  openings: string[];
  victims: { name: string; description: string }[];
  roomPool: { name: string; description: string; shape: RoomShape }[];
  weaponPool: { name: string; description: string }[];
  suspectPool: { name: string; role: string; description: string }[];
  foundPlaces: { kind: FoundPlaceKind; label: string }[];
  victimLooks: VictimLook[];
  /** Maps a suspect role to the badge drawn on its silhouette. */
  badgeByRole: Record<string, SuspectBadge>;
  discoveredTimes: string[];
  /** Caption templates; `{victim}`, `{place}`, `{title}` and `{time}` are replaced. */
  captionTemplates: Record<keyof IntroCaptions, string[]>;
};

/** A fully bound, validated case. Only the server holds it; views receive projections. */
export type CompiledCase = {
  seed: number;
  contentVersion: string;
  familyId: string;
  variantId: string;
  sceneId: SceneId;
  logic: CaseLogic;
  briefing: CaseBriefing;
  intro: IntroDescriptor;
  cards: Record<string, ClueFace>;
  /** Display label of every investigation target id (a suspect or an evidence document). */
  targets: Record<string, string>;
  reveal: CaseReveal;
};

/** Most independent boolean facts one logical configuration may use. */
export const MAX_FACTS = 8;

/** `fact` expression: a secondary boolean secret holds. */
export const fact = (id: string): Expr => ({ kind: "fact", id });
/** `answer` expression: the answer field equals `id`. */
export const is = (field: Field, id: string): Expr => ({ kind: "answer", field, id });
/** Negation. */
export const not = (expr: Expr): Expr => ({ kind: "not", expr });
/** Conjunction; true for no items. */
export const all = (...items: Expr[]): Expr => ({ kind: "all", items });
/** Disjunction; false for no items. */
export const any = (...items: Expr[]): Expr => ({ kind: "any", items });

/**
 * Evaluates an expression in a world.
 *
 * @param expr expression to evaluate.
 * @param world world supplying the answer and facts.
 * @returns whether the expression holds. A fact missing from the world is false.
 */
export function evalExpr(expr: Expr, world: World): boolean {
  switch (expr.kind) {
    case "fact":
      return world.facts[expr.id] === true;
    case "answer":
      return world.answer[expr.field] === expr.id;
    case "not":
      return !evalExpr(expr.expr, world);
    case "all":
      return expr.items.every((item) => evalExpr(item, world));
    case "any":
      return expr.items.some((item) => evalExpr(item, world));
  }
}
