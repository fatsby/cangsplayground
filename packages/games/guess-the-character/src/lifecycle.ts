import type { GroupId, PlayerId, SharedArgs } from "@cangsplayground/core";
import {
  advanceTurn,
  finishMatch,
  idleTimer,
  isTerminal,
  refreshAll,
  startVote,
  teamOf,
} from "./match.js";
import { prepareRound, validateGroups } from "./round.js";
import type { GuessConfig, GuessShared } from "./types.js";

type Args = SharedArgs<GuessConfig, GuessShared>;

export { resumeMatch } from "./match.js";

/**
 * Permanent departure: drop the player's unclosed vote and turn slot. A current speaker
 * hands the turn over exactly once; an emptied team ends only its own match, with no winner.
 */
export function handlePlayerLeft(
  args: Args & { playerId: PlayerId; groupId: GroupId | null },
): GuessShared {
  const next = structuredClone(args.shared);
  const { playerId } = args;
  for (const group of next.groups) group.members = group.members.filter((id) => id !== playerId);
  for (const match of next.matches) {
    const side = teamOf(match, playerId);
    if (side === null) continue;
    const team = match.teams[side];
    const index = team.members.indexOf(playerId);
    team.members.splice(index, 1);
    if (index < team.nextIndex) team.nextIndex--;
    if (team.nextIndex >= team.members.length) team.nextIndex = 0;
    if (isTerminal(match)) continue;
    delete match.votes[playerId];
    if (!team.members.length) {
      finishMatch(match, { reason: "empty-group" });
      continue;
    }
    if (match.phase === "PLAYING" && match.speakerId === playerId) {
      if (match.paused) {
        // A new, still-paused slot; Resume fills it from the asking team.
        match.speakerId = null;
        match.turnId++;
        match.timer = {
          ...idleTimer(args.config.turnSeconds * 1000),
          pausedRemainingMs: args.config.turnSeconds * 1000,
        };
      } else advanceTurn(match, args);
    }
  }
  refreshAll(next, args.roster);
  return next;
}

/** Connect/disconnect: refresh cached counts. Never resumes a paused match by itself. */
export function handleRosterChange(args: Args): GuessShared {
  const next = structuredClone(args.shared);
  refreshAll(next, args.roster);
  return next;
}

/** Current players of each stored group, in roster order. */
export function currentGroups(args: Pick<Args, "shared" | "roster">) {
  return args.shared.groups.map((g) => ({
    groupId: g.groupId,
    playerIds: args.roster.filter((r) => r.groupId === g.groupId).map((r) => r.playerId),
  }));
}

/** After every match is over: new pairing, characters and votes, straight into voting. */
export function newRound(args: Args): GuessShared | null {
  const { shared } = args;
  if (!shared.matches.every(isTerminal)) return null;
  const groups = currentGroups(args);
  if (validateGroups(groups) !== null) return null;
  const next = prepareRound(groups, shared.round + 1, args.rng);
  for (const match of next.matches) startVote(match, args);
  refreshAll(next, args.roster);
  return next;
}
