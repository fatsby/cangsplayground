import type { PlayerId } from "@cangsplayground/core";
import type { PlayerState } from "./PlayerState.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import type { Role } from "./types.js";

/** The current role of every player, as the pure rules expect it. */
export const rolesOf = (shared: WerewolfShared): Record<PlayerId, Role> =>
  Object.fromEntries(Object.entries(shared.players).map(([id, p]) => [id, p.role]));

/** Players who are in play: alive and not waiting to join at the next dawn. */
export const livingIds = (shared: WerewolfShared): PlayerId[] =>
  Object.entries(shared.players)
    .filter(([, p]) => p.alive && !p.pending)
    .map(([id]) => id);

/** The player with this id if they are in play, otherwise undefined. */
export const livingPlayer = (shared: WerewolfShared, id: PlayerId): PlayerState | undefined => {
  const p = shared.players[id];
  return p && p.alive && !p.pending ? p : undefined;
};

/** Ids of the living players holding `role` (the host may assign several Seers or Guards). */
export const livingWith = (shared: WerewolfShared, role: Role): PlayerId[] =>
  livingIds(shared).filter((id) => shared.players[id]!.role === role);
