import { shuffle, type GroupContext, type PlayerId, type Rng } from "@cangsplayground/core";
import { INVESTIGATION_ROUNDS, NO_CLOCK } from "./clock.js";
import { drawCaseSeed, generateCase } from "./generate.js";
import type { CompiledCase } from "./model.js";
import type { Conclusion, MurderShared, TeamState } from "./types.js";

/** Smallest and largest team the case is designed for. */
export const MIN_TEAM_SIZE = 3;
export const MAX_TEAM_SIZE = 4;

/**
 * Checks that a class can play: at least one team and every team of 3-4 players. An odd number
 * of teams is fine, and one team is allowed so a teacher can try the game alone.
 *
 * @param groups the groups the host prepared.
 * @returns a message naming the first problem, or null when every team is valid.
 */
export function validateTeams(
  groups: readonly Pick<GroupContext, "groupId" | "playerIds">[],
): string | null {
  if (groups.length === 0) return "Murder Mystery needs at least one team.";
  const bad = groups.find(
    (g) => g.playerIds.length < MIN_TEAM_SIZE || g.playerIds.length > MAX_TEAM_SIZE,
  );
  return bad
    ? `Each team needs ${MIN_TEAM_SIZE}-${MAX_TEAM_SIZE} players, but ${bad.groupId} has ${bad.playerIds.length}.`
    : null;
}

const emptyConclusion = (): Conclusion => ({
  suspectId: null,
  weaponId: null,
  roomId: null,
  evidence: { suspectId: [], weaponId: [], roomId: [] },
});

/**
 * Deals one team its starting cards and lead order.
 *
 * Cards and members are shuffled independently: with four players each holds one card; with
 * three, one holds two. The lead order is a separate shuffle: A,B,C,D for four, A,B,C,A for
 * three, so everyone leads once before anyone leads twice.
 */
function buildTeam(group: GroupContext, caseData: CompiledCase, rng: Rng): TeamState {
  const members: PlayerId[] = [...group.playerIds];
  const cards = shuffle(caseData.logic.initialCardIds, rng);
  const holders = shuffle(members, rng);
  const owners: Record<string, PlayerId> = {};
  cards.forEach((cardId, index) => {
    owners[cardId] = holders[index % holders.length]!;
  });
  const leads = shuffle(members, rng);
  const leadOrder = members.length === MAX_TEAM_SIZE ? leads : [...leads, leads[0]!];
  if (leadOrder.length !== INVESTIGATION_ROUNDS)
    throw new Error("lead order must have four entries");
  return {
    groupId: group.groupId,
    members,
    connected: [...members],
    leadOrder,
    owners,
    history: [],
    draft: emptyConclusion(),
    draftVersion: 0,
    submission: null,
    active: true,
  };
}

/**
 * Creates the shared state for a new case. No clock runs yet: the host presses Start.
 *
 * One case is generated for the whole class; each team gets its own card distribution and lead
 * order from independent shuffles.
 *
 * @param groups the prepared groups; each must hold 3-4 players.
 * @param caseNumber 1 for the first case of a session, then increasing.
 * @param rng session random stream; the case seed is drawn from it first.
 * @returns state in phase READY.
 * @throws RangeError when the class is empty or a team has the wrong size.
 * @throws Error when case generation fails; the host sees it through the Prepare error path.
 */
export function prepareCase(groups: GroupContext[], caseNumber: number, rng: Rng): MurderShared {
  const issue = validateTeams(groups);
  if (issue) throw new RangeError(issue);
  const caseData = generateCase(drawCaseSeed(rng));
  return {
    caseNumber,
    phase: "READY",
    phaseVersion: 0,
    investigationRound: 0,
    paused: false,
    clock: NO_CLOCK,
    revealedAt: null,
    caseData,
    teams: groups.map((group) => buildTeam(group, caseData, rng)),
  };
}

/** Index in `leadOrder` of the member who submits the final accusation (the last lead). */
export const SUBMITTER_INDEX = 3;

/**
 * The team whose frozen membership contains `playerId`. Display names never matter: a kicked
 * student who rejoins gets a new id and therefore belongs to no team.
 *
 * @returns the team, or undefined for a late joiner or removed player.
 */
export function teamOfPlayer(shared: MurderShared, playerId: PlayerId): TeamState | undefined {
  return shared.teams.find((team) => team.members.includes(playerId));
}

/** The member who may save drafts and confirm the accusation for `team`. */
export function submitterOf(team: TeamState): PlayerId {
  return team.leadOrder[SUBMITTER_INDEX]!;
}

/** Every card the team holds: starting cards plus investigation results. */
export function discoveredCardIds(team: TeamState): string[] {
  return Object.keys(team.owners);
}
