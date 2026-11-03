import type { MurderView } from "../types.js";

/**
 * The projected view the server sent for this device, or null when the session has none yet
 * (or sent something that is not a Murder Mystery view).
 */
export function murderView(session: { shared?: unknown }): MurderView | null {
  const shared = session.shared as MurderView | null | undefined;
  return shared && Array.isArray(shared.progress) && typeof shared.phase === "string"
    ? shared
    : null;
}

/** Display name of a suspect, weapon or room in the public briefing, or a neutral fallback. */
export function nameOf(view: MurderView, id: string | null): string {
  if (!id || !view.briefing) return "Not chosen yet";
  const all = [...view.briefing.suspects, ...view.briefing.weapons, ...view.briefing.rooms];
  return all.find((entity) => entity.id === id)?.name ?? "Not chosen yet";
}

/** Final round number of the investigation phase. */
export const ROUNDS = 4;
