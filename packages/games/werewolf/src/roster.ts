import type { PlayerId } from "@cangsplayground/core";
import { endGame } from "./ending.js";
import { livingIds, rolesOf } from "./players.js";
import { checkWinner } from "./rules.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import type { Role } from "./types.js";

const DEFAULT_JOINER_ROLE: Role = "villager";

/**
 * A new player joined the lobby while the game is running.
 * In SETUP they are an ordinary active villager the host can still edit. After the game has
 * started they wait as `pending` (host-editable role, default villager) and enter at the next dawn.
 * Once the game has ended they are ignored.
 */
export function playerJoined(shared: WerewolfShared, playerId: PlayerId): WerewolfShared {
  if (shared.stage === "ENDED" || shared.players[playerId]) return shared;
  shared.players[playerId] = {
    role: DEFAULT_JOINER_ROLE,
    alive: true,
    pending: shared.stage !== "SETUP",
  };
  shared.order.push(playerId);
  return shared;
}

/**
 * A player left the lobby for good.
 * - SETUP or still pending: removed as if they never joined.
 * - In play: treated as eliminated (their roles stay recorded for the final reveal) and every vote
 *   by or for them is dropped; the win check then runs and may end the game immediately. The current
 *   phase deadline is never touched, so a Seer or Guard leaving does not shorten the night.
 * - After the game ended: no change.
 */
export function playerLeft(shared: WerewolfShared, playerId: PlayerId): WerewolfShared {
  const leaver = shared.players[playerId];
  if (!leaver || shared.stage === "ENDED") return shared;
  if (shared.stage === "SETUP" || leaver.pending) {
    delete shared.players[playerId];
    shared.order = shared.order.filter((id) => id !== playerId);
    return shared;
  }
  leaver.alive = false;
  const without = (votes: Record<PlayerId, PlayerId>) =>
    Object.fromEntries(
      Object.entries(votes).filter(([voter, target]) => voter !== playerId && target !== playerId),
    );
  shared.wolfVotes = without(shared.wolfVotes);
  shared.dayVotes = without(shared.dayVotes);
  const winner = checkWinner(rolesOf(shared), livingIds(shared));
  if (winner) {
    shared.pendingWinner = winner;
    endGame(shared);
  }
  return shared;
}

/** At dawn every waiting joiner becomes a full player with the role the host chose (or villager). */
export function activatePending(shared: WerewolfShared): void {
  for (const player of Object.values(shared.players)) player.pending = false;
}

/**
 * Whether letting every waiting joiner in, with `playerId` holding `role`, would decide the game
 * on the spot. The host may not make that choice (spec: a joiner's role must not end the game).
 */
export function endsGameOnEntry(shared: WerewolfShared, playerId: PlayerId, role: Role): boolean {
  const roles = { ...rolesOf(shared), [playerId]: role };
  const entering = Object.entries(shared.players)
    .filter(([, p]) => p.pending && p.alive)
    .map(([id]) => id);
  return checkWinner(roles, [...livingIds(shared), ...entering]) !== null;
}
