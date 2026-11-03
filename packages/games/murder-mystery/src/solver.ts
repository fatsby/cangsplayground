import {
  MAX_FACTS,
  evalExpr,
  type Answer,
  type CaseLogic,
  type Expr,
  type Field,
  type Investigation,
  type LogicalCard,
  type World,
  type WorldDomains,
} from "./model.js";

/** The three answer fields, in the order they are scored. */
export const FIELDS: readonly Field[] = ["suspectId", "weaponId", "roomId"];

const answerKey = (answer: Answer): string =>
  `${answer.suspectId}|${answer.weaponId}|${answer.roomId}`;

/**
 * Enumerates the complete answer domain (suspects x weapons x rooms) times every assignment of
 * the boolean facts, then keeps only the worlds that satisfy the public rules.
 *
 * World ids are `w<index>` in the unfiltered enumeration order, so they do not depend on the
 * constraint. Distinct worlds may share an answer while differing in secondary facts.
 *
 * @param domains the closed vocabulary; at most {@link MAX_FACTS} fact ids.
 * @param publicConstraint rule every world must satisfy to be possible.
 * @returns the possible worlds in a deterministic order.
 * @throws RangeError when `domains.factIds` has more than {@link MAX_FACTS} entries.
 */
export function enumerateWorlds(domains: WorldDomains, publicConstraint: Expr): World[] {
  if (domains.factIds.length > MAX_FACTS) {
    throw new RangeError(`at most ${MAX_FACTS} facts are supported`);
  }
  const factCombinations = 2 ** domains.factIds.length;
  const worlds: World[] = [];
  let index = 0;
  for (const suspectId of domains.suspectIds) {
    for (const weaponId of domains.weaponIds) {
      for (const roomId of domains.roomIds) {
        for (let mask = 0; mask < factCombinations; mask++) {
          const facts: Record<string, boolean> = {};
          domains.factIds.forEach((id, bit) => {
            facts[id] = ((mask >> bit) & 1) === 1;
          });
          const world: World = {
            id: `w${index++}`,
            answer: { suspectId, weaponId, roomId },
            facts,
          };
          if (evalExpr(publicConstraint, world)) worlds.push(world);
        }
      }
    }
  }
  return worlds;
}

/**
 * Answers "what do the cards a team holds imply?". Built once per logical configuration because
 * it caches which worlds each card allows.
 */
export type Inference = {
  /** Distinct answers still possible given the verified cards among `knownCardIds`. */
  candidateAnswers(knownCardIds: readonly string[]): Answer[];
  /** One- and two-card evidence sets (at most two cards, per the scoring rule) proving `field`. */
  proofSets(knownCardIds: readonly string[], field: Field): string[][];
};

/**
 * Prepares inference over one logical configuration.
 *
 * Only verified cards constrain the truth; a testimony card is inert for candidates. The
 * authoritative worlds are `logic.worlds` (the validator proves they are the full universe).
 *
 * @param logic the configuration to reason over.
 * @returns an {@link Inference} whose methods throw on a card id that is not in `logic.cards`.
 */
export function buildInference(logic: CaseLogic): Inference {
  const cards = new Map<string, LogicalCard>(logic.cards.map((card) => [card.id, card]));
  const truth = logic.worlds.find((world) => world.id === logic.actualWorldId)?.answer;
  const constraintMasks = new Map<string, Uint8Array>();
  const claimMasks = new Map<string, Uint8Array>();

  const lookup = (id: string): LogicalCard => {
    const card = cards.get(id);
    if (!card) throw new Error(`unknown card ${id}`);
    return card;
  };
  const maskOf = (expressions: readonly Expr[]): Uint8Array =>
    Uint8Array.from(logic.worlds, (world) =>
      expressions.every((expression) => evalExpr(expression, world)) ? 1 : 0,
    );
  const constraintMask = (card: LogicalCard): Uint8Array => {
    let mask = constraintMasks.get(card.id);
    if (!mask) {
      mask = maskOf(card.constraint ? [card.constraint] : []);
      constraintMasks.set(card.id, mask);
    }
    return mask;
  };
  const claimMask = (card: LogicalCard): Uint8Array => {
    let mask = claimMasks.get(card.id);
    if (!mask) {
      mask = maskOf(card.claims);
      claimMasks.set(card.id, mask);
    }
    return mask;
  };
  const verifiedAmong = (ids: readonly string[]): LogicalCard[] =>
    ids.map(lookup).filter((card) => card.sourceKind === "verified");
  const survivingWorlds = (verified: readonly LogicalCard[]): number[] => {
    const masks = verified.map(constraintMask);
    const survivors: number[] = [];
    for (let i = 0; i < logic.worlds.length; i++) {
      if (masks.every((mask) => mask[i] === 1)) survivors.push(i);
    }
    return survivors;
  };

  return {
    candidateAnswers(knownCardIds) {
      const seen = new Map<string, Answer>();
      for (const index of survivingWorlds(verifiedAmong(knownCardIds))) {
        const answer = logic.worlds[index]!.answer;
        seen.set(answerKey(answer), answer);
      }
      return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
    },

    proofSets(knownCardIds, field) {
      if (!truth) return [];
      const ids = [...new Set(knownCardIds)].sort();
      const sets: string[][] = [];
      const consider = (subset: string[]) => {
        const members = subset.map(lookup);
        const verified = members.filter((card) => card.sourceKind === "verified");
        if (verified.length === 0) return;
        const survivors = survivingWorlds(verified);
        if (survivors.length === 0) return;
        const fixesField = survivors.every(
          (index) => logic.worlds[index]!.answer[field] === truth[field],
        );
        if (!fixesField) return;
        const testimonyEntailed = members
          .filter((card) => card.sourceKind === "testimony")
          .every((card) => survivors.every((index) => claimMask(card)[index] === 1));
        if (testimonyEntailed) sets.push(subset);
      };
      for (let i = 0; i < ids.length; i++) {
        consider([ids[i]!]);
        for (let j = i + 1; j < ids.length; j++) {
          consider([ids[i]!, ids[j]!]);
        }
      }
      return sets.sort((a, b) => {
        const left = a.join(",");
        const right = b.join(",");
        return left < right ? -1 : left > right ? 1 : 0;
      });
    },
  };
}

/**
 * Answers that remain possible once a team holds `knownCardIds`.
 *
 * @param logic the configuration.
 * @param knownCardIds cards the team has discovered; unverified testimony changes nothing.
 * @returns distinct answers consistent with the public rules and every verified card.
 * @throws Error when an id is not a card of `logic`.
 */
export function candidateAnswers(logic: CaseLogic, knownCardIds: readonly string[]): Answer[] {
  return buildInference(logic).candidateAnswers(knownCardIds);
}

/**
 * Investigations a team may choose next: not yet used, with every required action used and
 * every required card known. Availability never depends on what the solver thinks is useful.
 *
 * @param logic the configuration.
 * @param usedActionIds investigations the team has already spent.
 * @param knownCardIds cards the team holds.
 * @returns the offered investigations in authored order.
 */
export function availableActions(
  logic: CaseLogic,
  usedActionIds: readonly string[],
  knownCardIds: readonly string[],
): Investigation[] {
  const used = new Set(usedActionIds);
  const known = new Set(knownCardIds);
  return logic.actions.filter(
    (action) =>
      !used.has(action.id) &&
      action.requiredActionIds.every((id) => used.has(id)) &&
      action.requiredCardIds.every((id) => known.has(id)),
  );
}

/**
 * Evidence sets a team may cite for one answer field.
 *
 * A set holds one or two known cards. It is valid when every public world that satisfies the
 * set's verified cards has the true value for `field`; only the public rules and the set itself
 * count, never other cards the team holds. A testimony card may join a set only when the set's
 * verified cards entail every one of its claims.
 *
 * @param logic the configuration.
 * @param knownCardIds cards the team holds.
 * @param field the answer field to prove.
 * @returns valid sets, each sorted by card id, in a deterministic order.
 * @throws Error when an id is not a card of `logic`.
 */
export function proofSets(
  logic: CaseLogic,
  knownCardIds: readonly string[],
  field: Field,
): string[][] {
  return buildInference(logic).proofSets(knownCardIds, field);
}
