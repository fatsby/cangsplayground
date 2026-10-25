import type { PartId } from "./types.js";

export const PART_FRAMES: Record<PartId, string> = {
  problem: "Do you ever ___? It's a big problem.",
  product: "Our product is ___. It can ___.",
  story: "Imagine you ___. With our product, ___.",
  price: "It costs ${price}. That's cheaper than ___.",
  ask: "Please buy our product because ___.",
};

export function blankCount(frame: string): number {
  return frame.match(/___/g)?.length ?? 0;
}

export const QUESTION_BANK: string[] = [
  "How much is it?",
  "Who will buy it?",
  "Is it safe?",
  "Can you give me a discount?",
  "How does it work?",
  "Why do we need it?",
  "Is it easy to use?",
  "Can I try it?",
  "What colors can I choose?",
  "How is it better than other products?",
];
export const ANSWER_FRAMES: string[] = [
  "Good question. ___.",
  "Sorry, we can't. But ___.",
  "Yes, it can ___.",
  "It is useful because ___.",
];
export const HUDDLE_FRAMES: string[] = [
  "I think we should buy ___ because ___.",
  "I don't agree. It's too ___.",
  "We have $___ left.",
  "Let's buy ___ because ___.",
  "What do you think about ___?",
];
export const DECISION_FRAMES: { buy: string; pass: string } = {
  buy: "We are buying because ___.",
  pass: "We are not buying because ___.",
};
export const CLOSING_FRAME = "I bought ___ because ___.";
