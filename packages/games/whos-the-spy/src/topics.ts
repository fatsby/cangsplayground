import bank from "../data/topics.json" with { type: "json" };
import type { Category, Topic } from "./types.js";
export function topicsFor(category: Category): Topic[] {
  return bank[category] as Topic[];
}
export function topicById(id: string): Topic & { category: Category } {
  for (const category of ["location", "food"] as const) {
    const topic = topicsFor(category).find((t) => t.id === id);
    if (topic) return { ...topic, category };
  }
  throw new Error(`Unknown topic: ${id}`);
}
