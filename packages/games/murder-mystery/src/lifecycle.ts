import type { GroupId, PlayerId, SharedArgs } from "@cangsplayground/core";
import type { MurderConfig } from "./config.js";
import { INVESTIGATION_ROUNDS } from "./clock.js";
import { SUBMITTER_INDEX, teamOfPlayer } from "./round.js";
import type { MurderShared, TeamState } from "./types.js";

type Args = SharedArgs<MurderConfig, MurderShared>;

const withTeam = (shared: MurderShared, team: TeamState): MurderShared => ({
  ...shared,
  teams: shared.teams.map((t) => (t.groupId === team.groupId ? team : t)),
});

/**
 * First `leadOrder` index whose responsibility is still ahead: the current round during
 * investigation, only the submitter slot during the conclusion, none once the case is closed.
 * Earlier slots are history and are never rewritten.
 */
function firstFutureIndex(shared: MurderShared): number {
  switch (shared.phase) {
    case "INVESTIGATION":
      return shared.investigationRound - 1;
    case "CONCLUSION":
      return SUBMITTER_INDEX;
    case "AWAITING_REVEAL":
    case "REVEALED":
      return INVESTIGATION_ROUNDS;
    default:
      return 0;
  }
}

/**
 * Host reassignment: moves everything `from` holds to a connected teammate.
 *
 * All cards owned by `from` go to `to`, and `from` is replaced by `to` in the current and
 * future lead slots (including the submitter). Past slots and the investigation history are
 * untouched, nothing spends an investigation, and the move persists if `from` reconnects. It is
 * a host operation and stays available while the class is paused.
 *
 * @param shared the current state; not mutated.
 * @param groupId the team.
 * @param from current holder.
 * @param to receiver; must be a different, connected member of the same team.
 * @returns the new state, or null when the team is unknown/inactive or either id is not a valid
 *   member, or the receiver is offline.
 */
export function transferResponsibilities(
  shared: MurderShared,
  groupId: GroupId,
  from: PlayerId,
  to: PlayerId,
): MurderShared | null {
  const team = shared.teams.find((t) => t.groupId === groupId);
  if (!team || !team.active || from === to) return null;
  if (!team.members.includes(from) || !team.members.includes(to) || !team.connected.includes(to)) {
    return null;
  }
  const owners = Object.fromEntries(
    Object.entries(team.owners).map(([card, owner]) => [card, owner === from ? to : owner]),
  );
  const cut = firstFutureIndex(shared);
  const leadOrder = team.leadOrder.map((id, index) => (index >= cut && id === from ? to : id));
  return withTeam(shared, { ...team, owners, leadOrder });
}

/** Next remaining member after `leaver` in frozen order, preferring one who is connected. */
function replacementLead(
  team: TeamState,
  leaver: PlayerId,
  remaining: PlayerId[],
  connected: PlayerId[],
): PlayerId {
  const start = team.members.indexOf(leaver);
  const cycle = team.members.map((_, i) => team.members[(start + 1 + i) % team.members.length]!);
  const candidates = cycle.filter((id) => id !== leaver && remaining.includes(id));
  return candidates.find((id) => connected.includes(id)) ?? candidates[0]!;
}

/**
 * A player left or was removed for good.
 *
 * Their frozen membership ends: the id can no longer act. Each of their cards goes to the
 * remaining member holding the fewest (ties by frozen member order), and every current or future
 * lead slot they held passes to the next connected remaining member (or the next remaining one).
 * One or two survivors keep playing. A team left with nobody becomes inactive and keeps any
 * frozen submission. Nothing spends an investigation or touches history and drafts.
 *
 * @param args state and the departed player; `groupId` is advisory, membership is by id.
 * @returns the new state, or `args.shared` itself when the player was on no team.
 */
export function handlePlayerLeft(
  args: Args & { playerId: PlayerId; groupId: GroupId | null },
): MurderShared {
  const { shared, playerId } = args;
  const team = teamOfPlayer(shared, playerId);
  if (!team) return shared;
  const members = team.members.filter((id) => id !== playerId);
  const connected = team.connected.filter((id) => id !== playerId);
  if (members.length === 0) {
    return withTeam(shared, { ...team, members, connected, active: false });
  }
  const counts = new Map<PlayerId, number>(members.map((id) => [id, 0]));
  for (const owner of Object.values(team.owners)) {
    if (counts.has(owner)) counts.set(owner, counts.get(owner)! + 1);
  }
  const owners: Record<string, PlayerId> = {};
  for (const [card, owner] of Object.entries(team.owners)) {
    if (owner !== playerId) {
      owners[card] = owner;
      continue;
    }
    const receiver = members.reduce((best, id) =>
      counts.get(id)! < counts.get(best)! ? id : best,
    );
    owners[card] = receiver;
    counts.set(receiver, counts.get(receiver)! + 1);
  }
  const cut = firstFutureIndex(shared);
  const leadOrder = team.leadOrder.map((id, index) =>
    index >= cut && id === playerId ? replacementLead(team, playerId, members, connected) : id,
  );
  return withTeam(shared, { ...team, members, connected, owners, leadOrder });
}

/**
 * Someone connected or disconnected: refresh each team's cached `connected` list, which views
 * need because they receive no live roster. Cards, members and lead order never change.
 *
 * @param args state and the live roster.
 * @returns the new state, or `args.shared` itself when no team's online members changed.
 */
export function handleRosterChange(args: Args): MurderShared {
  const { shared, roster } = args;
  let changed = false;
  const teams = shared.teams.map((team) => {
    const connected = team.members.filter((id) =>
      roster.some((entry) => entry.playerId === id && entry.connected),
    );
    if (
      connected.length === team.connected.length &&
      connected.every((id, i) => id === team.connected[i])
    ) {
      return team;
    }
    changed = true;
    return { ...team, connected };
  });
  return changed ? { ...shared, teams } : shared;
}
