import { shuffle, type GroupId, type PlayerId, type Rng } from "@cangsplayground/core";
import type { GuessMatch, GuessShared, MatchTeam } from "./types.js";
import { idleTimer } from "./match.js";

export interface RoundGroup {
  groupId: GroupId;
  playerIds: readonly PlayerId[];
}

/** Plain-English reason the groups cannot play, or null. */
export function validateGroups(groups: readonly RoundGroup[]): string | null {
  const n = groups.length;
  if (n < 2) return "Guess the Character needs at least 2 groups.";
  if (n % 2)
    return `Guess the Character needs an even number of groups. You have ${n}. Make ${n - 1} or ${n + 1} groups.`;
  if (groups.some((g) => g.playerIds.length === 0))
    return "Every group needs at least 1 player. Exit the game and make new groups.";
  return null;
}

function team(group: RoundGroup, rng: Rng): MatchTeam {
  return {
    groupId: group.groupId,
    members: shuffle(group.playerIds, rng),
    nextIndex: 0,
    characterId: null,
    cooldown: idleTimer(),
    guessVersion: 0,
  };
}

/** Shuffles all groups, pairs neighbours and shuffles each team's speaking order. */
export function prepareRound(groups: readonly RoundGroup[], round: number, rng: Rng): GuessShared {
  const order = shuffle(groups, rng);
  const matches: GuessMatch[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) {
    const teams: [MatchTeam, MatchTeam] = [team(order[i]!, rng), team(order[i + 1]!, rng)];
    matches.push({
      id: `r${round}m${i / 2 + 1}`,
      phase: "READY",
      phaseVersion: 0,
      teams,
      categoryId: null,
      votes: {},
      timer: idleTimer(),
      paused: false,
      pauseReason: null,
      askingTeam: rng.int(2) as 0 | 1,
      speakerId: null,
      turnId: 0,
      nextSpeakerId: null,
      connectedCounts: [teams[0].members.length, teams[1].members.length],
      winnerGroupId: null,
      endReason: null,
    });
  }
  return {
    round,
    groups: groups.map((g) => ({ groupId: g.groupId, members: [...g.playerIds] })),
    matches,
  };
}
