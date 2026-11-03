import {
  MAX_FACTS,
  evalExpr,
  type CaseLogic,
  type Expr,
  type Field,
  type ValidationReport,
} from "./model.js";
import {
  FIELDS,
  availableActions,
  buildInference,
  enumerateWorlds,
  type Inference,
} from "./solver.js";

/** Investigations every team performs; the finite graph is explored to exactly this depth. */
const ROUTE_LENGTH = 4;
const SUSPECT_COUNT = 4;
const WEAPON_COUNT = 3;
const ROOM_COUNT = 4;
const INITIAL_CARD_COUNT = 4;
const MIN_ROUTES = 2;

const sameExpr = (a: Expr, b: Expr): boolean => JSON.stringify(a) === JSON.stringify(b);

function domainFor(logic: CaseLogic, field: Field): string[] {
  const { suspectIds, weaponIds, roomIds } = logic.domains;
  return field === "suspectId" ? suspectIds : field === "weaponId" ? weaponIds : roomIds;
}

function exprIssues(logic: CaseLogic, expr: Expr, where: string, out: string[]): void {
  switch (expr.kind) {
    case "fact":
      if (!logic.domains.factIds.includes(expr.id)) out.push(`unknown fact ${expr.id} in ${where}`);
      return;
    case "answer":
      if (!domainFor(logic, expr.field).includes(expr.id)) {
        out.push(`unknown ${expr.field} ${expr.id} in ${where}`);
      }
      return;
    case "not":
      exprIssues(logic, expr.expr, where, out);
      return;
    case "all":
    case "any":
      for (const item of expr.items) exprIssues(logic, item, where, out);
  }
}

const worldKey = (w: { answer: Record<string, string>; facts: Record<string, boolean> }): string =>
  `${w.answer.suspectId}|${w.answer.weaponId}|${w.answer.roomId}|` +
  Object.keys(w.facts)
    .sort()
    .map((id) => `${id}=${w.facts[id] ? 1 : 0}`)
    .join(",");

/** Defects found without running inference: shape, references, counts, delivery and universe. */
function structuralIssues(logic: CaseLogic): string[] {
  const issues: string[] = [];
  const { domains } = logic;

  if (domains.suspectIds.length !== SUSPECT_COUNT)
    issues.push(`expected ${SUSPECT_COUNT} suspects`);
  if (domains.weaponIds.length !== WEAPON_COUNT) issues.push(`expected ${WEAPON_COUNT} weapons`);
  if (domains.roomIds.length !== ROOM_COUNT) issues.push(`expected ${ROOM_COUNT} rooms`);
  if (domains.factIds.length > MAX_FACTS) issues.push(`use at most ${MAX_FACTS} facts`);
  for (const [name, ids] of Object.entries(domains)) {
    if (new Set(ids).size !== ids.length) issues.push(`duplicate ids in ${name}`);
  }

  exprIssues(logic, logic.publicConstraint, "the public constraint", issues);

  const cards = new Map(logic.cards.map((card) => [card.id, card]));
  if (cards.size !== logic.cards.length) issues.push("duplicate card ids");
  const actionIds = new Set(logic.actions.map((a) => a.id));
  if (actionIds.size !== logic.actions.length) issues.push("duplicate action ids");

  const actual = logic.worlds.find((w) => w.id === logic.actualWorldId);
  if (!actual) {
    issues.push(`actual world ${logic.actualWorldId} is not in the world list`);
  } else if (!evalExpr(logic.publicConstraint, actual)) {
    issues.push(`actual world ${actual.id} violates the public constraint`);
  }

  for (const card of logic.cards) {
    if (card.claims.length === 0) issues.push(`card ${card.id} has no claims`);
    card.claims.forEach((claim) => exprIssues(logic, claim, `card ${card.id}`, issues));
    if (card.sourceKind === "testimony") {
      if (card.constraint !== null)
        issues.push(`testimony card ${card.id} must not carry a constraint`);
      continue;
    }
    if (!card.constraint || !sameExpr(card.constraint, { kind: "all", items: card.claims })) {
      issues.push(`verified card ${card.id}: constraint must equal its claims`);
    }
    if (actual) {
      card.claims.forEach((claim, index) => {
        if (!evalExpr(claim, actual)) {
          issues.push(`verified card ${card.id}: claim ${index + 1} is false in the true world`);
        }
      });
    }
  }

  if (
    logic.initialCardIds.length !== INITIAL_CARD_COUNT ||
    new Set(logic.initialCardIds).size !== INITIAL_CARD_COUNT ||
    !logic.initialCardIds.every((id) => cards.has(id))
  ) {
    issues.push(`expected exactly ${INITIAL_CARD_COUNT} initial cards that exist`);
  }

  const deliveries = new Map<string, number>();
  const deliver = (id: string) => deliveries.set(id, (deliveries.get(id) ?? 0) + 1);
  logic.initialCardIds.forEach(deliver);
  for (const action of logic.actions) {
    if (action.resultCardIds.length < 1 || action.resultCardIds.length > 2) {
      issues.push(`action ${action.id} must yield 1-2 result cards`);
    }
    action.resultCardIds.forEach(deliver);
    for (const id of [...action.resultCardIds, ...action.requiredCardIds]) {
      if (!cards.has(id)) issues.push(`action ${action.id} references unknown card ${id}`);
    }
    for (const id of action.requiredActionIds) {
      if (!actionIds.has(id) || id === action.id) {
        issues.push(`action ${action.id} has an invalid required action ${id}`);
      }
    }
    if (action.kind === "challenge") {
      const relevant = action.requiredCardIds.some(
        (id) => cards.get(id)?.sourceId === action.targetId,
      );
      if (!relevant) {
        issues.push(`challenge ${action.id} needs evidence that comes from ${action.targetId}`);
      }
    }
  }
  for (const card of logic.cards) {
    const count = deliveries.get(card.id) ?? 0;
    if (count > 1) issues.push(`card ${card.id} is delivered more than once`);
    if (count === 0) issues.push(`card ${card.id} is never delivered`);
  }

  if (domains.factIds.length <= MAX_FACTS) {
    const expected = enumerateWorlds(domains, logic.publicConstraint).map(worldKey).sort();
    const supplied = logic.worlds.map(worldKey).sort();
    const identical =
      expected.length === supplied.length && expected.every((key, i) => key === supplied[i]);
    if (!identical) {
      issues.push(
        `world universe differs from the enumerated universe (${supplied.length} supplied, ${expected.length} expected)`,
      );
    }
  }
  return issues;
}

/** Which initial cards change something at one terminal state of a route. */
function cardsThatMatterAt(
  logic: CaseLogic,
  inference: Inference,
  known: string[],
  matters: Set<string>,
): void {
  const candidates = inference.candidateAnswers(known).length;
  for (const id of logic.initialCardIds) {
    const without = known.filter((card) => card !== id);
    if (inference.candidateAnswers(without).length > candidates) {
      matters.add(id);
      continue;
    }
    if (FIELDS.some((field) => inference.proofSets(without, field).length === 0)) matters.add(id);
  }
}

/**
 * Proves, by exhausting the finite action graph, that a logical configuration is fit to play.
 *
 * Checks, in order: structure (counts, references, card delivery, the world universe equal to
 * the full re-enumerated one so a hand-picked candidate list cannot manufacture uniqueness,
 * verified claims true in the true world); then inference (public rules decide no field, several
 * suspects remain at the start, no single card reveals the whole answer); then every reachable
 * sequence of {@link ROUTE_LENGTH} offered actions: no dead end earlier, exactly one candidate
 * answer at the end, a one- or two-card proof for every field, and at least two distinct
 * four-action routes. An initial card must matter: required by an action, or removing it
 * enlarges the candidates or removes every proof of a field at some terminal.
 *
 * Content-level concerns (B1 wording, reveal explanations for false statements) are checked by
 * the generator tests, not here.
 *
 * @param logic the configuration to validate.
 * @returns whether it is sound, every issue found with the offending path, and the number of
 *   distinct four-action routes (unordered action sets) explored.
 */
export function validateCase(logic: CaseLogic): ValidationReport {
  const issues = structuralIssues(logic);
  if (issues.length > 0) return { ok: false, issues, terminalPaths: 0 };

  const inference = buildInference(logic);
  const truth = logic.worlds.find((w) => w.id === logic.actualWorldId)!.answer;

  const publicAnswers = inference.candidateAnswers([]);
  for (const field of FIELDS) {
    if (new Set(publicAnswers.map((a) => a[field])).size < 2) {
      issues.push(`the public rules already decide ${field}`);
    }
  }
  const initialSuspects = new Set(
    inference.candidateAnswers(logic.initialCardIds).map((a) => a.suspectId),
  );
  if (initialSuspects.size < 2)
    issues.push("at least two suspects must remain after the initial cards");
  for (const card of logic.cards) {
    if (inference.candidateAnswers([card.id]).length === 1) {
      issues.push(`single card ${card.id} reveals the entire answer`);
    }
  }

  const resultsOf = new Map(logic.actions.map((a) => [a.id, a.resultCardIds]));
  const knownAfter = (used: string[]) => [
    ...logic.initialCardIds,
    ...used.flatMap((id) => resultsOf.get(id) ?? []),
  ];
  const seen = new Set<string>();
  const terminals = new Set<string>();
  const matters = new Set<string>();

  const explore = (used: string[]): void => {
    const key = [...used].sort().join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const known = knownAfter(used);
    const label = `[${[...used].sort().join(", ")}]`;
    if (used.length === ROUTE_LENGTH) {
      terminals.add(key);
      const candidates = inference.candidateAnswers(known);
      if (candidates.length !== 1) {
        issues.push(`ambiguous after ${label}: ${candidates.length} answers remain`);
      } else if (
        candidates[0]!.suspectId !== truth.suspectId ||
        candidates[0]!.weaponId !== truth.weaponId ||
        candidates[0]!.roomId !== truth.roomId
      ) {
        issues.push(`after ${label} the only remaining answer is not the true one`);
      }
      for (const field of FIELDS) {
        if (inference.proofSets(known, field).length === 0) {
          issues.push(`no proof for ${field} after ${label}`);
        }
      }
      cardsThatMatterAt(logic, inference, known, matters);
      return;
    }
    const next = availableActions(logic, used, known);
    if (next.length === 0) {
      issues.push(`dead end after ${label}: no investigation is available`);
      return;
    }
    for (const action of next) explore([...used, action.id]);
  };
  explore([]);

  const required = new Set(logic.actions.flatMap((a) => a.requiredCardIds));
  for (const id of logic.initialCardIds) {
    if (!matters.has(id) && !required.has(id)) issues.push(`unused initial card ${id}`);
  }
  if (terminals.size < MIN_ROUTES) {
    issues.push(`fewer than two distinct four-action routes (${terminals.size} found)`);
  }
  return { ok: issues.length === 0, issues, terminalPaths: terminals.size };
}
