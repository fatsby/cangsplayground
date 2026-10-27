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

// One short example for each blank, in the same order as the sentence.
export const FRAME_HINTS: Record<string, string[]> = {
  [PART_FRAMES.problem]: ["feel tired"],
  [PART_FRAMES.product]: ["a robot", "carry your books"],
  [PART_FRAMES.story]: ["are late for school", "you get there fast"],
  [PART_FRAMES.price]: ["a new bike"],
  [PART_FRAMES.ask]: ["it saves time"],
  [ANSWER_FRAMES[0]!]: ["It costs $30"],
  [ANSWER_FRAMES[1]!]: ["we can give you a discount"],
  [ANSWER_FRAMES[2]!]: ["fly"],
  [ANSWER_FRAMES[3]!]: ["it saves time"],
  [HUDDLE_FRAMES[0]!]: ["two robots", "they help us"],
  [HUDDLE_FRAMES[1]!]: ["expensive"],
  [HUDDLE_FRAMES[2]!]: ["50"],
  [HUDDLE_FRAMES[3]!]: ["one robot", "it is useful"],
  [HUDDLE_FRAMES[4]!]: ["the flying bag"],
  [DECISION_FRAMES.buy]: ["it saves time"],
  [DECISION_FRAMES.pass]: ["it costs too much"],
  [CLOSING_FRAME]: ["a robot", "it helps me"],
};
