import {
  all,
  type CaseLogic,
  type CaseTemplate,
  type Investigation,
  type LogicalCard,
} from "../model.js";
import { enumerateWorlds } from "../solver.js";
import { accessTemplates } from "./access.js";
import { alibiTemplates } from "./alibi.js";
import { exchangeTemplates } from "./exchange.js";

/** Slot ids shared by every template; the truth is always `s3` / `w2` / `r4`. */
const SLOT_DOMAINS = {
  suspectIds: ["s1", "s2", "s3", "s4"],
  weaponIds: ["w1", "w2", "w3"],
  roomIds: ["r1", "r2", "r3", "r4"],
};
const TRUTH_SLOTS = { suspectId: "s3", weaponId: "w2", roomId: "r4" } as const;

/** Difficult words with Vietnamese meanings; cards show the ones their text contains. */
export const GLOSSARY: readonly { en: string; vi: string }[] = [
  { en: "guilty", vi: "có tội" },
  { en: "confirmed", vi: "được xác nhận" },
  { en: "admits", vi: "thừa nhận" },
  { en: "accusation", vi: "lời buộc tội" },
  { en: "rumor", vi: "tin đồn" },
  { en: "cabinet", vi: "tủ có khóa" },
  { en: "cupboard", vi: "tủ đồ" },
  { en: "locked", vi: "bị khóa" },
  { en: "lock", vi: "ổ khóa" },
  { en: "key", vi: "chìa khóa" },
  { en: "swapped", vi: "bị đổi chỗ" },
  { en: "labels", vi: "nhãn" },
  { en: "porter", vi: "nhân viên khuân vác" },
  { en: "gardener", vi: "người làm vườn" },
  { en: "camera", vi: "máy quay" },
  { en: "weapon", vi: "hung khí" },
  { en: "guest list", vi: "danh sách khách" },
  { en: "arrived", vi: "đã đến" },
  { en: "course", vi: "món ăn trong bữa" },
  { en: "stopped", vi: "đã dừng" },
  { en: "broken", vi: "bị vỡ" },
  { en: "belongs", vi: "thuộc về" },
  { en: "nervous", vi: "lo lắng" },
  { en: "taxi", vi: "xe taxi" },
  { en: "tools", vi: "dụng cụ" },
];

const TEMPLATES: readonly CaseTemplate[] = [
  ...alibiTemplates(),
  ...accessTemplates(),
  ...exchangeTemplates(),
];

/**
 * The authored, name-free case configurations: two variants for each of three families
 * (alibi/time, access/key, exchange/identity). Each is bounded and exhaustively validated.
 *
 * @returns the six templates in a stable order.
 */
export function caseTemplates(): readonly CaseTemplate[] {
  return TEMPLATES;
}

/**
 * Builds the logical configuration for a template: the complete world universe, the true world,
 * the cards (a verified card's constraint is the conjunction of its claims) and the actions.
 *
 * @param template an authored template.
 * @returns the slot-level {@link CaseLogic}, ready for {@link validateCase}.
 * @throws Error when the template's truth world is not in its universe.
 */
export function toLogic(template: CaseTemplate): CaseLogic {
  const domains = { ...SLOT_DOMAINS, factIds: template.factIds };
  const worlds = enumerateWorlds(domains, template.publicConstraint);
  const actual = worlds.find(
    (world) =>
      world.answer.suspectId === TRUTH_SLOTS.suspectId &&
      world.answer.weaponId === TRUTH_SLOTS.weaponId &&
      world.answer.roomId === TRUTH_SLOTS.roomId &&
      template.factIds.every((id) => world.facts[id] === template.truthFacts[id]),
  );
  if (!actual)
    throw new Error(`template ${template.familyId}/${template.variantId} has no true world`);
  const cards: LogicalCard[] = template.cards.map((card) => ({
    id: card.id,
    sourceKind: card.kind,
    claims: card.claims,
    constraint: card.kind === "verified" ? all(...card.claims) : null,
    sourceId: card.source,
  }));
  const actions: Investigation[] = template.actions.map((action) => ({
    id: action.id,
    kind: action.kind,
    targetId: action.target,
    prompt: action.prompt,
    requiredCardIds: action.needs ?? [],
    requiredActionIds: action.after ?? [],
    resultCardIds: action.yields,
  }));
  return {
    domains,
    worlds,
    actualWorldId: actual.id,
    publicConstraint: template.publicConstraint,
    initialCardIds: template.initialCardIds,
    cards,
    actions,
  };
}

let configurations: readonly CaseLogic[] | null = null;

/**
 * The slot-level logical configuration of every template, built once.
 *
 * @returns six {@link CaseLogic} values in template order.
 */
export function logicalConfigurations(): readonly CaseLogic[] {
  configurations ??= TEMPLATES.map(toLogic);
  return configurations;
}
