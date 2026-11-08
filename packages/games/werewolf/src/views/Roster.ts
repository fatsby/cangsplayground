import type { PlayerSummary } from "@cangsplayground/core";

/** Lobby players by id, for names and avatars. Unknown ids (players who left) get a neutral name. */
export interface Roster {
  get(id: string): PlayerSummary | undefined;
  name(id: string): string;
}
