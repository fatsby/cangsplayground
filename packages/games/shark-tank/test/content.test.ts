import { expect, it } from "vitest";
import { ideas, ideaById } from "../src/ideas.js";
import {
  PART_FRAMES,
  blankCount,
  QUESTION_BANK,
  ANSWER_FRAMES,
  HUDDLE_FRAMES,
  DECISION_FRAMES,
  CLOSING_FRAME,
} from "../src/phrases.js";
import { configSchema, GAME_ID, PART_ORDER } from "../src/types.js";

it("has 25–30 ideas with unique ids", () => {
  expect(ideas().length).toBeGreaterThanOrEqual(25);
  expect(ideas().length).toBeLessThanOrEqual(30);
  expect(new Set(ideas().map((idea) => idea.id)).size).toBe(ideas().length);
});

it("each idea has 6–8 keywords with en+vi and 2–3 selling points", () => {
  for (const idea of ideas()) {
    for (const field of [idea.id, idea.name, idea.emoji, idea.pitch])
      expect(field.trim().length).toBeGreaterThan(0);
    expect(idea.keywords.length).toBeGreaterThanOrEqual(6);
    expect(idea.keywords.length).toBeLessThanOrEqual(8);
    for (const keyword of idea.keywords) {
      expect(keyword.en.trim().length).toBeGreaterThan(0);
      expect(keyword.vi.trim().length).toBeGreaterThan(0);
    }
    expect(idea.sellingPoints.length).toBeGreaterThanOrEqual(2);
    expect(idea.sellingPoints.length).toBeLessThanOrEqual(3);
    for (const point of idea.sellingPoints) expect(point.trim().length).toBeGreaterThan(0);
  }
});

it("finds every idea by id and throws for an unknown id", () => {
  for (const idea of ideas()) expect(ideaById(idea.id)).toEqual(idea);
  expect(() => ideaById("missing-idea")).toThrow(/Unknown idea/);
});

it("every part frame has at least one blank; price frame has {price}", () => {
  expect(PART_ORDER).toEqual(["problem", "product", "story", "price", "ask"]);
  expect(Object.keys(PART_FRAMES)).toEqual(PART_ORDER);
  for (const part of PART_ORDER) expect(blankCount(PART_FRAMES[part])).toBeGreaterThan(0);
  expect(PART_FRAMES.price).toBe("It costs ${price}. That's cheaper than ___.");
});

it("blankCount counts ___", () => {
  expect(blankCount("Our product is ___. It can ___.")).toBe(2);
  expect(blankCount("No blanks here.")).toBe(0);
  expect(blankCount("")).toBe(0);
});

it("provides English speaking support for each stage", () => {
  expect(QUESTION_BANK.length).toBe(10);
  expect(new Set(QUESTION_BANK).size).toBe(QUESTION_BANK.length);
  for (const question of QUESTION_BANK) expect(question).toMatch(/\?$/);
  for (const bank of [ANSWER_FRAMES, HUDDLE_FRAMES]) {
    expect(bank.length).toBeGreaterThanOrEqual(2);
    for (const frame of bank) expect(blankCount(frame)).toBeGreaterThan(0);
  }
  expect(DECISION_FRAMES.buy).toContain("We are buying because ___");
  expect(DECISION_FRAMES.pass).toContain("We are not buying because ___");
  expect(CLOSING_FRAME).toBe("I bought ___ because ___.");
});

it("config defaults match the spec", () => {
  expect(GAME_ID).toBe("shark-tank");
  expect(configSchema.parse({})).toEqual({
    prepMinutes: 15,
    pitchSeconds: 120,
    qaSeconds: 180,
    huddleSeconds: 90,
    moneyPerMember: 100,
    minPrice: 10,
    maxPrice: 60,
    minSpendPercent: 60,
    noQuestionPenalty: 20,
  });
});

it("rejects minPrice > maxPrice", () => {
  expect(configSchema.safeParse({ minPrice: 70 }).success).toBe(false);
  expect(configSchema.safeParse({ minPrice: 60, maxPrice: 60 }).success).toBe(true);
});

it.each([
  ["prepMinutes", 5, 40],
  ["pitchSeconds", 30, 600],
  ["qaSeconds", 30, 900],
  ["huddleSeconds", 30, 300],
  ["moneyPerMember", 10, 1000],
  ["minPrice", 1, 1000],
  ["maxPrice", 1, 1000],
  ["minSpendPercent", 0, 100],
  ["noQuestionPenalty", 0, 500],
] as const)("validates the integer range for %s", (field, min, max) => {
  const parse = (value: unknown) =>
    configSchema.safeParse({ minPrice: 1, maxPrice: 1000, [field]: value }).success;
  expect(parse(min)).toBe(true);
  expect(parse(max)).toBe(true);
  for (const invalid of [min - 1, max + 1, min + 0.5, String(min), null])
    expect(parse(invalid)).toBe(false);
});
