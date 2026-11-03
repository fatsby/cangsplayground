import { createRng, shuffle, type Rng } from "@cangsplayground/core";
import { GLOSSARY, caseTemplates, toLogic } from "./cases/catalogue.js";
import { scenePresets } from "./cases/scenes.js";
import { buildIntro } from "./intro.js";
import {
  evalExpr,
  type CardSpec,
  type CaseLogic,
  type CaseTemplate,
  type CompiledCase,
  type Expr,
  type Field,
} from "./model.js";
import type { CaseBriefing, CaseReveal, ClueFace, EntityFace, SceneId } from "./types.js";
import { validateCase } from "./validate.js";

/** Version of the authored content; the same seed and version always rebuild the same case. */
export const CONTENT_VERSION = "1";

const SEED_RANGE = 2_147_483_647;
const MAX_VOCABULARY = 4;
// No vowels: a random token can never spell a word that hints at what the id belongs to.
const TOKEN_HEAD = "bcdfghjklmnpqrstvwxyz";
const TOKEN_TAIL = "bcdfghjklmnpqrstvwxyz0123456789";
const TOKEN_TAIL_LENGTH = 5;
const SLOTS = ["s1", "s2", "s3", "s4", "w1", "w2", "w3", "r1", "r2", "r3", "r4"] as const;

/** Case selection for tests and tooling; omit it to draw scene and configuration from the seed. */
export type CaseSelection = { familyId: string; variantId: string; sceneId?: SceneId };

/**
 * Draws a case seed from a random stream.
 *
 * @param rng the stream, typically the session's.
 * @returns an integer in `[0, 2147483647)` that `generateCase` accepts.
 */
export function drawCaseSeed(rng: Rng): number {
  return rng.int(SEED_RANGE);
}

type Names = ReadonlyMap<string, string>;

function makeTokenSource(rng: Rng): () => string {
  const used = new Set<string>();
  return () => {
    for (;;) {
      let token = TOKEN_HEAD[rng.int(TOKEN_HEAD.length)]!;
      for (let i = 0; i < TOKEN_TAIL_LENGTH; i++) token += TOKEN_TAIL[rng.int(TOKEN_TAIL.length)]!;
      if (!used.has(token)) {
        used.add(token);
        return token;
      }
    }
  };
}

const upperSentenceStarts = (text: string): string =>
  text.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
  );

/** Replaces `{slot}`, `{found}`, `{place}` and `{victim}`; any other placeholder is a content bug. */
function fill(text: string, names: Names): string {
  const filled = text.replace(/\{([a-z0-9]+)\}/g, (_match, key: string) => {
    const value = names.get(key);
    if (value === undefined) throw new Error(`unbound placeholder {${key}} in "${text}"`);
    return value;
  });
  return upperSentenceStarts(filled);
}

const SUBJECTS: Record<Field, { is: string; not: string; oneOf: string }> = {
  suspectId: {
    is: "%1 is the guilty person",
    not: "%1 is not the guilty person",
    oneOf: "the guilty person is %1 or %2",
  },
  weaponId: {
    is: "the weapon was %1",
    not: "the weapon was not %1",
    oneOf: "the weapon was %1 or %2",
  },
  roomId: {
    is: "the crime happened in %1",
    not: "the crime did not happen in %1",
    oneOf: "the crime happened in %1 or %2",
  },
};

function phrase(pattern: string, ...values: string[]): string {
  return pattern.replace(/%(\d)/g, (_m, index: string) => values[Number(index) - 1] ?? "");
}

/** Turns one claim into a spoken clause; throws on a shape the lexicon cannot tell. */
function describeClaim(expr: Expr, template: CaseTemplate, names: Names): string {
  const nameOf = (slot: string): string => {
    const name = names.get(slot);
    if (!name) throw new Error(`no name for ${slot}`);
    return name;
  };
  if (expr.kind === "fact") return template.factClauses[expr.id]!.yes;
  if (expr.kind === "answer") return phrase(SUBJECTS[expr.field].is, nameOf(expr.id));
  if (expr.kind === "not") {
    if (expr.expr.kind === "fact") return template.factClauses[expr.expr.id]!.no;
    if (expr.expr.kind === "answer") {
      return phrase(SUBJECTS[expr.expr.field].not, nameOf(expr.expr.id));
    }
  }
  if (expr.kind === "any" && expr.items.length === 2) {
    const [a, b] = expr.items;
    if (a?.kind === "answer" && b?.kind === "answer" && a.field === b.field) {
      return phrase(SUBJECTS[a.field].oneOf, nameOf(a.id), nameOf(b.id));
    }
  }
  throw new Error(`cannot describe claim ${JSON.stringify(expr)} in ${template.variantId}`);
}

function cardBody(spec: CardSpec, template: CaseTemplate, names: Names): string {
  const speaker = names.get(spec.source) ?? template.documents[spec.source];
  if (!speaker) throw new Error(`card ${spec.id} has an unknown source ${spec.source}`);
  const claimSentences = spec.claims.map((claim) => {
    const spoken = describeClaim(claim, template, names);
    return spec.kind === "verified"
      ? `It is confirmed that ${spoken}.`
      : `${speaker} says that ${spoken}.`;
  });
  const sentences = [spec.intro, ...claimSentences, ...(spec.note ? [spec.note] : [])];
  return sentences.map((sentence) => fill(sentence, names)).join(" ");
}

function vocabularyFor(body: string): ClueFace["vocabulary"] {
  return GLOSSARY.filter((entry) => new RegExp(`\\b${entry.en}\\b`, "i").test(body)).slice(
    0,
    MAX_VOCABULARY,
  );
}

function remapExpr(expr: Expr, idOf: (id: string) => string): Expr {
  switch (expr.kind) {
    case "fact":
      return expr;
    case "answer":
      return { kind: "answer", field: expr.field, id: idOf(expr.id) };
    case "not":
      return { kind: "not", expr: remapExpr(expr.expr, idOf) };
    default:
      return { kind: expr.kind, items: expr.items.map((item) => remapExpr(item, idOf)) };
  }
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[rng.int(items.length)]!;
}

/**
 * Builds one complete, validated case from a seed.
 *
 * Order of random draws: scene, configuration, then the suspects/rooms/weapons shuffles, victim,
 * body-found place, title and opening, opaque ids, action and card order, and finally the intro.
 * The scene is drawn independently of the configuration, so it correlates with nothing. A
 * `selection` forces the configuration and/or scene but not the stream, so the same seed with
 * the same selection is reproducible. The instantiated logic is validated exhaustively.
 *
 * @param seed integer seed; the same seed and {@link CONTENT_VERSION} rebuild the same case.
 * @param selection optional forced family/variant (both required) and scene.
 * @returns the compiled case. Only the server may hold it: it carries the logic and the seed.
 * @throws Error when the selection is unknown, a template cannot be told in words, a false
 *   statement has no reveal explanation, or the instantiated case fails validation.
 */
export function generateCase(seed: number, selection?: CaseSelection): CompiledCase {
  const rng = createRng(seed);
  const scenes = scenePresets();
  const templates = caseTemplates();
  const drawnScene = pick(scenes, rng);
  const drawnTemplate = pick(templates, rng);
  const scene = selection?.sceneId ? scenes.find((s) => s.id === selection.sceneId) : drawnScene;
  if (!scene) throw new Error(`unknown scene ${selection?.sceneId}`);
  const template = selection
    ? templates.find(
        (t) => t.familyId === selection.familyId && t.variantId === selection.variantId,
      )
    : drawnTemplate;
  if (!template) {
    throw new Error(`unknown case ${selection?.familyId}/${selection?.variantId}`);
  }

  const suspects = shuffle(scene.suspectPool, rng).slice(0, 4);
  const rooms = shuffle(scene.roomPool, rng).slice(0, 4);
  const weapons = shuffle(scene.weaponPool, rng).slice(0, 3);
  const victim = pick(scene.victims, rng);
  const foundPlace = pick(scene.foundPlaces, rng);
  const title = pick(scene.titles, rng);
  const openingTemplate = pick(scene.openings, rng);

  const names = new Map<string, string>([
    ...suspects.map((s, i): [string, string] => [`s${i + 1}`, s.name]),
    ...weapons.map((w, i): [string, string] => [`w${i + 1}`, w.name]),
    ...rooms.map((r, i): [string, string] => [`r${i + 1}`, r.name]),
    ["found", foundPlace.label],
    ["place", foundPlace.label],
    ["victim", victim.name],
    ["house", scene.venue],
  ]);

  const nextToken = makeTokenSource(rng);
  const tokens = new Map<string, string>();
  for (const key of [
    ...SLOTS,
    "victim",
    ...Object.keys(template.documents),
    ...template.cards.map((c) => c.id),
    ...template.actions.map((a) => a.id),
  ]) {
    tokens.set(key, nextToken());
  }
  const idOf = (key: string): string => {
    const token = tokens.get(key);
    if (!token) throw new Error(`no token for ${key}`);
    return token;
  };

  const base = toLogic(template);
  const truthWorld = base.worlds.find((w) => w.id === base.actualWorldId)!;
  for (const card of template.cards) {
    const isFalse = card.kind === "testimony" && card.claims.some((x) => !evalExpr(x, truthWorld));
    if (isFalse && !template.reveal.explanations[card.id]) {
      throw new Error(
        `false statement ${card.id} in ${template.variantId} has no reveal explanation`,
      );
    }
  }

  const logic: CaseLogic = {
    domains: {
      suspectIds: base.domains.suspectIds.map(idOf),
      weaponIds: base.domains.weaponIds.map(idOf),
      roomIds: base.domains.roomIds.map(idOf),
      factIds: base.domains.factIds,
    },
    worlds: base.worlds.map((world) => ({
      ...world,
      answer: {
        suspectId: idOf(world.answer.suspectId),
        weaponId: idOf(world.answer.weaponId),
        roomId: idOf(world.answer.roomId),
      },
    })),
    actualWorldId: base.actualWorldId,
    publicConstraint: remapExpr(base.publicConstraint, idOf),
    initialCardIds: base.initialCardIds.map(idOf),
    cards: shuffle(
      base.cards.map((card) => ({
        ...card,
        id: idOf(card.id),
        claims: card.claims.map((claim) => remapExpr(claim, idOf)),
        constraint: card.constraint ? remapExpr(card.constraint, idOf) : null,
        sourceId: idOf(card.sourceId),
      })),
      rng,
    ),
    actions: shuffle(
      base.actions.map((action) => ({
        ...action,
        id: idOf(action.id),
        targetId: idOf(action.targetId),
        prompt: fill(action.prompt, names),
        requiredCardIds: action.requiredCardIds.map(idOf),
        requiredActionIds: action.requiredActionIds.map(idOf),
        resultCardIds: action.resultCardIds.map(idOf),
      })),
      rng,
    ),
  };

  const face = (kind: "s" | "w" | "r", index: number, description: string): EntityFace => ({
    id: idOf(`${kind}${index + 1}`),
    name: names.get(`${kind}${index + 1}`)!,
    description,
  });
  const rules = template.ruleText.map((line) => fill(line, names)).join(" ");
  const briefing: CaseBriefing = {
    title,
    opening: `${fill(openingTemplate, names)} ${rules}`,
    victim: { id: idOf("victim"), name: victim.name, description: victim.description },
    bodyFoundAt: foundPlace.label,
    suspects: shuffle(
      suspects.map((s, i) => face("s", i, s.description)),
      rng,
    ),
    weapons: shuffle(
      weapons.map((w, i) => face("w", i, w.description)),
      rng,
    ),
    rooms: shuffle(
      rooms.map((r, i) => face("r", i, r.description)),
      rng,
    ),
  };

  const cards: Record<string, ClueFace> = {};
  for (const spec of template.cards) {
    const body = cardBody(spec, template, names);
    const isSlot = names.has(spec.source) && /^s\d$/.test(spec.source);
    const label = isSlot ? names.get(spec.source)! : template.documents[spec.source]!;
    cards[idOf(spec.id)] = {
      id: idOf(spec.id),
      sourceLabel: `${spec.kind === "verified" ? "Confirmed" : "Statement"} — ${label}`,
      sourceKind: spec.kind,
      body,
      vocabulary: vocabularyFor(body),
    };
  }

  const targets: Record<string, string> = {};
  for (const action of template.actions) {
    targets[idOf(action.target)] = /^s\d$/.test(action.target)
      ? names.get(action.target)!
      : template.documents[action.target]!;
  }

  const reveal: CaseReveal = {
    answer: { suspectId: idOf("s3"), weaponId: idOf("w2"), roomId: idOf("r4") },
    events: template.reveal.events.map((line) => fill(line, names)),
    testimonyExplanations: Object.entries(template.reveal.explanations).map(([cardId, text]) => ({
      cardId: idOf(cardId),
      explanation: fill(text, names),
    })),
  };

  const intro = buildIntro({ scene, briefing, rng });
  const report = validateCase(logic);
  if (!report.ok) {
    throw new Error(
      `generated case ${template.familyId}/${template.variantId} is invalid: ${report.issues.join("; ")}`,
    );
  }
  return {
    seed,
    contentVersion: CONTENT_VERSION,
    familyId: template.familyId,
    variantId: template.variantId,
    sceneId: scene.id,
    logic,
    briefing,
    intro,
    cards,
    targets,
    reveal,
  };
}
