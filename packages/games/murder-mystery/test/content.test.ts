import { createRng } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import { caseTemplates, logicalConfigurations, toLogic } from "../src/cases/catalogue.js";
import { drawCaseSeed, generateCase } from "../src/generate.js";
import type { CaseTemplate, Expr } from "../src/model.js";
import { evalExpr } from "../src/model.js";
import { validateCase } from "../src/validate.js";

const FAMILIES = ["alibi", "access", "exchange"] as const;
const VARIANTS: Record<(typeof FAMILIES)[number], string[]> = {
  alibi: ["window", "route"],
  access: ["key-transfer", "door-access"],
  exchange: ["swapped-items", "swapped-recipients"],
};

/** The shape of a rule with names removed: which kinds of things it ties together. */
function shape(expr: Expr): string {
  switch (expr.kind) {
    case "fact":
      return "fact";
    case "answer":
      return expr.field.replace("Id", "");
    case "not":
      return `!${shape(expr.expr)}`;
    default:
      return `${expr.kind}(${expr.items.map(shape).sort().join(",")})`;
  }
}

/** Prerequisite and action structure after canonicalizing names. */
function structure(t: CaseTemplate): string {
  const index = new Map(t.actions.map((a, i) => [a.id, i]));
  return JSON.stringify({
    kinds: t.actions.map((a) => a.kind),
    after: t.actions.map((a) => (a.after ?? []).map((id) => index.get(id)).sort()),
    needs: t.actions.map((a) => (a.needs ?? []).length),
    yields: t.actions.map((a) => a.yields.length),
    facts: t.factIds.length,
  });
}

describe("catalogue", () => {
  it("holds six bounded configurations: two variants for each of three families", () => {
    const templates = caseTemplates();
    expect(templates).toHaveLength(6);
    for (const family of FAMILIES) {
      expect(
        templates
          .filter((t) => t.familyId === family)
          .map((t) => t.variantId)
          .sort(),
      ).toEqual([...VARIANTS[family]].sort());
    }
    expect(logicalConfigurations()).toHaveLength(6);
  });

  it.each(caseTemplates().map((t) => [`${t.familyId}/${t.variantId}`, t] as const))(
    "%s validates exhaustively with several routes",
    (_name, template) => {
      const report = validateCase(toLogic(template));
      expect(report.issues).toEqual([]);
      expect(report.ok).toBe(true);
      expect(report.terminalPaths).toBeGreaterThanOrEqual(2);
    },
  );

  it("gives each family two different action/fact structures", () => {
    for (const family of FAMILIES) {
      const [a, b] = caseTemplates().filter((t) => t.familyId === family);
      expect(structure(a!)).not.toEqual(structure(b!));
    }
  });

  it("makes the three families need different relationships to deduce", () => {
    const rules = FAMILIES.map((family) => {
      const [a, b] = caseTemplates().filter((t) => t.familyId === family);
      expect(shape(a!.publicConstraint)).toEqual(shape(b!.publicConstraint));
      return shape(a!.publicConstraint);
    });
    expect(new Set(rules).size).toBe(3);
  });

  it("keeps the true world consistent with every fact the template claims", () => {
    for (const template of caseTemplates()) {
      const logic = toLogic(template);
      const truth = logic.worlds.find((w) => w.id === logic.actualWorldId)!;
      expect(truth.answer).toEqual({ suspectId: "s3", weaponId: "w2", roomId: "r4" });
      expect(evalExpr(logic.publicConstraint, truth)).toBe(true);
    }
  });
});

describe("generateCase", () => {
  it("is deterministic for a seed and shaped like the spec", () => {
    const a = generateCase(17);
    expect(generateCase(17)).toEqual(a);
    expect(a.briefing.suspects).toHaveLength(4);
    expect(a.briefing.weapons).toHaveLength(3);
    expect(a.briefing.rooms).toHaveLength(4);
    expect(a.logic.initialCardIds).toHaveLength(4);
    expect(a.contentVersion).toBe("1");
    expect(a.seed).toBe(17);
    for (const action of a.logic.actions) {
      expect(action.resultCardIds.length).toBeGreaterThanOrEqual(1);
      expect(action.resultCardIds.length).toBeLessThanOrEqual(2);
    }
    expect(validateCase(a.logic).ok).toBe(true);
  });

  it("draws a reproducible seed from an rng", () => {
    expect(drawCaseSeed(createRng(5))).toBe(drawCaseSeed(createRng(5)));
    expect(drawCaseSeed(createRng(5))).not.toBe(drawCaseSeed(createRng(6)));
  });

  it("separates where the body was found from where the crime happened", () => {
    const c = generateCase(3);
    expect(c.briefing.rooms.map((r) => r.name)).not.toContain(c.briefing.bodyFoundAt);
    expect(c.briefing.rooms.map((r) => r.id)).toContain(c.reveal.answer.roomId);
    expect(c.briefing.bodyFoundAt.length).toBeGreaterThan(0);
  });

  it("varies who did it and where the culprit sits in the list across seeds", () => {
    const positions = new Set<number>();
    const culprits = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const c = generateCase(seed);
      positions.add(c.briefing.suspects.findIndex((s) => s.id === c.reveal.answer.suspectId));
      culprits.add(c.briefing.suspects.find((s) => s.id === c.reveal.answer.suspectId)!.name);
    }
    expect(positions.size).toBeGreaterThan(1);
    expect(culprits.size).toBeGreaterThan(2);
  });

  it("uses every family and variant over a sample of seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const c = generateCase(seed);
      seen.add(`${c.familyId}/${c.variantId}`);
    }
    expect(seen.size).toBe(6);
  });

  it("delivers only neutral ids that encode no slot, family or role", () => {
    const c = generateCase(9, { familyId: "access", variantId: "key-transfer" });
    const ids = [
      ...c.briefing.suspects.map((e) => e.id),
      ...c.briefing.weapons.map((e) => e.id),
      ...c.briefing.rooms.map((e) => e.id),
      c.briefing.victim.id,
      ...Object.keys(c.cards),
      ...c.logic.actions.map((a) => a.id),
    ];
    for (const id of [...ids, ...Object.keys(c.targets)]) {
      expect(id).toMatch(/^[a-z][a-z0-9]{5,}$/);
      expect(id).not.toMatch(/alibi|access|exchange|key|culprit|answer|truth/);
    }
    expect(new Set(ids).size).toBe(ids.length);
    // a target is either one of the suspects or an evidence document, never a new kind of id
    const suspectIds = new Set(c.briefing.suspects.map((s) => s.id));
    expect(Object.keys(c.targets).filter((id) => !suspectIds.has(id))).not.toEqual([]);
    const other = generateCase(10, { familyId: "access", variantId: "key-transfer" });
    expect(other.briefing.suspects.map((e) => e.id)).not.toEqual(
      c.briefing.suspects.map((e) => e.id),
    );
  });

  it("tells the player what the solver reasons from", () => {
    for (const template of caseTemplates()) {
      const c = generateCase(21, { familyId: template.familyId, variantId: template.variantId });
      const names = new Map(
        [...c.briefing.suspects, ...c.briefing.weapons, ...c.briefing.rooms].map((e) => [
          e.id,
          e.name,
        ]),
      );
      for (const card of c.logic.cards) {
        const face = c.cards[card.id]!;
        // title abbreviations such as "Dr." and "Mr." do not end a sentence
        const sentences = face.body.replace(/\b(Mr|Mrs|Ms|Dr)\./g, "$1").split(/(?<=[.!?])\s+/);
        expect(sentences.length).toBeGreaterThanOrEqual(2);
        expect(sentences.length).toBeLessThanOrEqual(4);
        for (const claim of card.claims) {
          for (const id of answerIds(claim)) {
            expect(face.body.toLowerCase()).toContain(names.get(id)!.toLowerCase());
          }
        }
        expect(face.sourceKind).toBe(card.sourceKind);
        expect(face.sourceLabel.length).toBeGreaterThan(0);
        expect(face.vocabulary.every((v) => v.en.length > 0 && v.vi.length > 0)).toBe(true);
      }
    }
  });

  it("states every public rule in the opening", () => {
    const c = generateCase(4);
    const template = caseTemplates().find(
      (t) => t.familyId === c.familyId && t.variantId === c.variantId,
    )!;
    expect(c.briefing.opening.split(/\s+/).length).toBeGreaterThan(template.ruleText.length * 3);
    for (const entity of [...c.briefing.rooms, ...c.briefing.suspects]) {
      expect(entity.name.length).toBeGreaterThan(0);
    }
    expect(c.briefing.opening).not.toMatch(/\{[a-z0-9]+\}/);
  });

  it("explains every false statement and exposes no unbound placeholder", () => {
    for (const template of caseTemplates()) {
      const c = generateCase(33, { familyId: template.familyId, variantId: template.variantId });
      const truth = c.logic.worlds.find((w) => w.id === c.logic.actualWorldId)!;
      const falseTestimony = c.logic.cards.filter(
        (card) => card.sourceKind === "testimony" && card.claims.some((x) => !evalExpr(x, truth)),
      );
      expect(falseTestimony.length).toBeGreaterThanOrEqual(1);
      const explained = new Set(c.reveal.testimonyExplanations.map((e) => e.cardId));
      for (const card of falseTestimony) expect(explained.has(card.id)).toBe(true);
      expect(c.reveal.events.length).toBeGreaterThanOrEqual(3);
      const text = JSON.stringify([c.briefing, c.cards, c.reveal, c.targets, c.logic.actions]);
      expect(text).not.toMatch(/\{[a-z0-9:]+\}/);
    }
  });

  it("words the building after the scene, never after another scene", () => {
    for (const template of caseTemplates()) {
      const hotel = generateCase(8, { ...template, sceneId: "hotel-night" });
      const manor = generateCase(8, { ...template, sceneId: "manor-night" });
      const textOf = (c: typeof hotel) => JSON.stringify([c.briefing, c.cards, c.reveal]);
      expect(textOf(hotel)).not.toMatch(/\bhouse\b/i);
      expect(textOf(manor)).not.toMatch(/\bhotel\b/i);
    }
  });

  it("rejects an unknown family or variant with a descriptive error", () => {
    expect(() => generateCase(1, { familyId: "nope", variantId: "x" })).toThrow(/unknown case/i);
  });

  it("keeps the family and variant out of the public briefing", () => {
    for (const template of caseTemplates()) {
      const c = generateCase(12, { familyId: template.familyId, variantId: template.variantId });
      const text = JSON.stringify(c.briefing);
      expect(text).not.toContain(c.familyId);
      expect(text).not.toContain(c.variantId);
    }
  });
});

function answerIds(expr: Expr): string[] {
  switch (expr.kind) {
    case "answer":
      return [expr.id];
    case "fact":
      return [];
    case "not":
      return answerIds(expr.expr);
    default:
      return expr.items.flatMap(answerIds);
  }
}
