/**
 * Server-only logical model of one murder case: the finite universe of "worlds", the
 * expressions evaluated over them, the clue cards and the investigation graph.
 *
 * Nothing in this file may be imported by browser code: it describes the hidden truth.
 * Public presentation types live in `types.ts` and import `Answer`/`Field` type-only.
 */

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

/** Most independent boolean facts one logical configuration may use. */
export const MAX_FACTS = 8;

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
