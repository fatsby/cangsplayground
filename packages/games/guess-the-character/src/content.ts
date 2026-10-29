import characterData from "../data/characters.json" with { type: "json" };
import categoryData from "../data/categories.json" with { type: "json" };
import type { Category, CategoryOption, Character } from "./types.js";

/**
 * Server-only answer bank. Views must never import this file: it holds every
 * character and alias, and only the role-filtered GuessView may reach clients.
 */

type CategoryRecord = Category & { examples: string[] };
const CHARACTERS: readonly Character[] = characterData;
const CATEGORIES: readonly CategoryRecord[] = categoryData;
const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

/** NFKC, lowercase, then keep only letters and numbers: "Spider-Man" = "spider man". */
export function normalizeGuess(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function characters(): readonly Character[] {
  return CHARACTERS;
}

export function categories(): readonly Category[] {
  return CATEGORIES;
}

export function characterById(id: string): Character {
  const character = BY_ID.get(id);
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}

export function categoryById(id: string): Category {
  const category = CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown category: ${id}`);
  return category;
}

export function isCategoryId(id: string): boolean {
  return CATEGORIES.some((c) => c.id === id);
}

/** Static examples only — never derived from a match's secrets. */
export function categoryOptions(): CategoryOption[] {
  return CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    examples: c.examples.map((id) => characterById(id).name),
  }));
}

export function matchesCharacter(input: string, characterId: string): boolean {
  const guess = normalizeGuess(input);
  if (!guess) return false;
  const character = characterById(characterId);
  return [character.name, ...character.aliases].some((name) => normalizeGuess(name) === guess);
}
