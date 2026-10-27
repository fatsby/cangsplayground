import bank from "../data/ideas.json" with { type: "json" };
import type { Idea } from "./types.js";

export function ideas(): Idea[] {
  return bank;
}

export function ideaById(id: string): Idea {
  const idea = ideas().find((idea) => idea.id === id);
  if (!idea) throw new Error(`Unknown idea: ${id}`);
  return idea;
}
