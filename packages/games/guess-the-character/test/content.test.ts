import { describe, expect, it } from "vitest";
import {
  categories,
  categoryOptions,
  characterById,
  characters,
  matchesCharacter,
  normalizeGuess,
} from "../src/content.js";
import { generalHelp, HELP_CATEGORY_IDS, languageHelp } from "../src/phrases.js";
import { configSchema } from "../src/types.js";

const CATEGORY_IDS = [
  "superheroes",
  "disney-princesses",
  "classic-cartoons",
  "animated-movies",
  "anime-manga",
  "video-game-characters",
  "fairy-tales",
  "vietnamese-folk-tales",
  "famous-villains",
];

describe("config", () => {
  it("parses the defaults", () => {
    expect(configSchema.parse({})).toEqual({
      voteSeconds: 30,
      turnSeconds: 120,
      cooldownSeconds: 5,
    });
  });

  it.each([
    ["voteSeconds", 10, 180],
    ["turnSeconds", 15, 600],
    ["cooldownSeconds", 1, 60],
  ] as const)("accepts %s from %i to %i only", (key, min, max) => {
    expect(configSchema.safeParse({ [key]: min }).success).toBe(true);
    expect(configSchema.safeParse({ [key]: max }).success).toBe(true);
    expect(configSchema.safeParse({ [key]: min - 1 }).success).toBe(false);
    expect(configSchema.safeParse({ [key]: max + 1 }).success).toBe(false);
    expect(configSchema.safeParse({ [key]: min + 0.5 }).success).toBe(false);
    expect(configSchema.safeParse({ [key]: String(min) }).success).toBe(false);
  });
});

describe("content", () => {
  it("has the nine approved categories with 10–12 unique characters", () => {
    expect(categories().map((c) => c.id)).toEqual(CATEGORY_IDS);
    expect(categories()).toHaveLength(9);
    for (const c of categories()) {
      expect(c.characterIds.length).toBeGreaterThanOrEqual(10);
      expect(c.characterIds.length).toBeLessThanOrEqual(12);
      expect(new Set(c.characterIds).size).toBe(c.characterIds.length);
      for (const id of c.characterIds) expect(() => characterById(id)).not.toThrow();
    }
  });

  it("has unique character IDs and non-empty normalized names and aliases", () => {
    const ids = characters().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of characters())
      for (const name of [c.name, ...c.aliases]) expect(normalizeGuess(name)).not.toBe("");
  });

  it("never lets a name or alias match two characters in one category", () => {
    for (const category of categories()) {
      const owner = new Map<string, string>();
      for (const id of category.characterIds) {
        const c = characterById(id);
        for (const name of new Set([c.name, ...c.aliases].map(normalizeGuess))) {
          expect(owner.get(name) ?? id, `${name} in ${category.id}`).toBe(id);
          owner.set(name, id);
        }
      }
    }
  });

  it("reuses one ID for cross-listed fairy-tale princesses", () => {
    const princesses = categories().find((c) => c.id === "disney-princesses")!;
    const tales = categories().find((c) => c.id === "fairy-tales")!;
    for (const id of ["snow-white", "cinderella", "rapunzel"]) {
      expect(princesses.characterIds).toContain(id);
      expect(tales.characterIds).toContain(id);
    }
    expect(characters().filter((c) => c.name === "Snow White")).toHaveLength(1);
  });

  it("matches exact normalized names and curated aliases only", () => {
    expect(matchesCharacter("  SPIDER—MAN  ", "spider-man")).toBe(true);
    expect(matchesCharacter("spider man", "spider-man")).toBe(true);
    expect(matchesCharacter("Spidermen", "spider-man")).toBe(false);
    expect(matchesCharacter("Thor DC Comics", "thor")).toBe(false);
    expect(matchesCharacter("Thanh Giong", "thanh-giong")).toBe(true);
    expect(matchesCharacter("THÁNH GIÓNG", "thanh-giong")).toBe(true);
    // Decomposed input composes under NFKC.
    expect(matchesCharacter("Thánh Gióng", "thanh-giong")).toBe(true);
    expect(matchesCharacter("Thuỷ Tinh", "thuy-tinh")).toBe(true);
    expect(matchesCharacter("Bạch Tuyết", "snow-white")).toBe(true);
    expect(matchesCharacter("conan", "conan")).toBe(true);
    expect(matchesCharacter("Luffy", "luffy")).toBe(true);
    expect(matchesCharacter("Monkey D Luffy", "luffy")).toBe(true);
    expect(matchesCharacter("!!!", "thor")).toBe(false);
    expect(matchesCharacter("", "thor")).toBe(false);
    // Vietnamese accents are not stripped automatically.
    expect(matchesCharacter("Sơn Tình", "son-tinh")).toBe(false);
  });

  it("throws a developer error for an unknown ID", () => {
    expect(() => characterById("nobody")).toThrow(/Unknown character/);
  });

  it("offers each category with two or three static examples from its own pool", () => {
    const options = categoryOptions();
    expect(options).toHaveLength(9);
    for (const option of options) {
      expect(Object.keys(option).sort()).toEqual(["examples", "id", "name"]);
      expect(option.examples.length).toBeGreaterThanOrEqual(2);
      expect(option.examples.length).toBeLessThanOrEqual(3);
      const pool = categories()
        .find((c) => c.id === option.id)!
        .characterIds.map((id) => characterById(id).name);
      for (const example of option.examples) expect(pool).toContain(example);
    }
    // Test fixtures use these as secrets, so they must not be public examples.
    expect(options.flatMap((o) => o.examples)).not.toContain("Thor");
    expect(options.flatMap((o) => o.examples)).not.toContain("Spider-Man");
  });
});

describe("language help", () => {
  it("covers every category at A1 and A2", () => {
    expect([...HELP_CATEGORY_IDS].sort()).toEqual([...CATEGORY_IDS].sort());
    for (const c of categories()) {
      for (const level of ["A1", "A2"] as const) {
        const h = languageHelp(c.id, level);
        expect(h.questions.length).toBeGreaterThanOrEqual(3);
        expect(h.answers.length).toBeGreaterThanOrEqual(3);
        expect(h.vocabulary.length).toBeGreaterThanOrEqual(6);
        expect(h.grammar.en).not.toBe("");
        expect(h.grammar.vi).not.toBe("");
        for (const phrase of [...h.questions, ...h.answers, ...h.vocabulary]) {
          expect(phrase.en.trim()).not.toBe("");
          expect(phrase.vi.trim()).not.toBe("");
        }
      }
    }
  });

  it("does not use one vocabulary set for every category", () => {
    const sets = categories().map((c) =>
      languageHelp(c.id, "A1")
        .vocabulary.map((v) => v.en)
        .join(),
    );
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("never names a character in help text", () => {
    const names = characters().flatMap((c) => [c.name, ...c.aliases].map(normalizeGuess));
    const words = (text: string) =>
      text
        .split(/[\s,.!?“”"()/:;]+/)
        .map(normalizeGuess)
        .filter(Boolean);
    for (const c of categories())
      for (const level of ["A1", "A2"] as const) {
        const h = languageHelp(c.id, level);
        const text = [...h.questions, ...h.answers, ...h.vocabulary, h.grammar]
          .map((x) => x.en)
          .join(" ");
        for (const word of words(text)) {
          // Generic words that are also short aliases (e.g. "Hook", "Genie").
          if (["hook", "cat", "duck", "dog"].includes(word)) continue;
          expect(names, `${word} in ${c.id}/${level}`).not.toContain(word);
        }
      }
  });

  it("offers general help without a category", () => {
    expect(generalHelp("A1").questions.length).toBeGreaterThanOrEqual(3);
    expect(() => languageHelp("unknown", "A1")).toThrow();
  });
});
