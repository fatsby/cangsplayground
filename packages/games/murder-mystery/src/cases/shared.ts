import { any, is, type ActionSpec, type CardSpec, type CaseTemplate, type Expr } from "../model.js";

/** What the variants of one family have in common: everything except actions and used cards. */
export type FamilyBase = Omit<CaseTemplate, "variantId" | "actions">;

/**
 * Builds one variant from its family base. The family keeps a library of cards; the variant
 * keeps only those it delivers (an initial card or an action result), so no card is orphaned.
 *
 * @param base the family's shared fields, including the full card library.
 * @param variantId stable id of the variant.
 * @param actions the variant's investigations.
 * @returns a template whose cards are exactly the delivered ones, in library order.
 */
export function variantOf(
  base: FamilyBase,
  variantId: string,
  actions: ActionSpec[],
): CaseTemplate {
  const delivered = new Set([...base.initialCardIds, ...actions.flatMap((a) => a.yields)]);
  return {
    ...base,
    variantId,
    actions,
    cards: base.cards.filter((card) => delivered.has(card.id)),
  };
}

/** Evidence documents every family starts from (key -> label). */
export const INITIAL_DOCUMENTS: Record<string, string> = {
  guest: "Guest list",
  report: "Police report",
  plan: "Floor plan",
};

/**
 * The four starting clues of a case: three confirmed findings that each narrow one answer field
 * to two options (so at the start two suspects, two weapons and two rooms remain open), plus
 * one unverified statement written by the family.
 *
 * @param statement kind, source and claims of the fourth card (`i4`); it should be misleading.
 * @param text intro and closing sentence of that statement.
 * @returns cards `i1`..`i4`.
 */
export function commonInitialCards(
  statement: { kind: CardSpec["kind"]; source: string; claims: Expr[] },
  text: { intro: string; note: string },
): CardSpec[] {
  return [
    {
      id: "i1",
      kind: "verified",
      source: "guest",
      claims: [any(is("suspectId", "s1"), is("suspectId", "s3"))],
      intro: "The police read the guest list for the night.",
      note: "Everyone else had already left the {house}.",
    },
    {
      id: "i2",
      kind: "verified",
      source: "report",
      claims: [any(is("weaponId", "w1"), is("weaponId", "w2"))],
      intro: "The police checked every object in the {house}.",
      note: "The other objects were never moved that night.",
    },
    {
      id: "i3",
      kind: "verified",
      source: "plan",
      claims: [any(is("roomId", "r3"), is("roomId", "r4"))],
      intro: "The police studied the plan of the {house}.",
      note: "The other rooms were full of people all evening.",
    },
    { id: "i4", ...statement, intro: text.intro, note: text.note },
  ];
}
