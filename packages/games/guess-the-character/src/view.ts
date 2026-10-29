import type { GroupId, PlayerId, TimerState, Viewer } from "@cangsplayground/core";
import { categoryOptions, characterById } from "./content.js";
import { isTerminal, teamOf } from "./match.js";
import { canStartRound } from "./actions.js";
import { validateGroups } from "./round.js";
import type {
  CharacterFace,
  GuessConfig,
  GuessMatch,
  GuessShared,
  GuessView,
  MatchPrivateView,
  MatchPublicView,
} from "./types.js";

const timer = (t: TimerState): TimerState => ({
  endsAt: t.endsAt,
  pausedRemainingMs: t.pausedRemainingMs,
  durationMs: t.durationMs,
});

function face(id: string | null): CharacterFace | null {
  if (!id) return null;
  const { name } = characterById(id);
  return { id, name };
}

function publicMatch(match: GuessMatch): MatchPublicView {
  const members = new Set([...match.teams[0].members, ...match.teams[1].members]);
  return {
    id: match.id,
    phase: match.phase,
    phaseVersion: match.phaseVersion,
    categoryId: match.categoryId,
    paused: match.paused,
    pauseReason: match.pauseReason,
    speakerId: match.speakerId,
    turnId: match.turnId,
    winnerGroupId: match.winnerGroupId,
    endReason: match.endReason,
    timer: timer(match.timer),
    groupIds: [match.teams[0].groupId, match.teams[1].groupId],
    members: [[...match.teams[0].members], [...match.teams[1].members]],
    askingGroupId: match.phase === "PLAYING" ? match.teams[match.askingTeam].groupId : null,
    nextSpeakerId: match.nextSpeakerId,
    connectedCounts: [match.connectedCounts[0], match.connectedCounts[1]],
    votedCount: Object.keys(match.votes).filter((id) => members.has(id)).length,
    voterCount: members.size,
  };
}

function privateMatch(match: GuessMatch, viewer: Viewer): MatchPrivateView | null {
  if (viewer.kind === "host")
    return {
      matchId: match.id,
      characters: match.teams.map((t) => ({ groupId: t.groupId, character: face(t.characterId) })),
      votes: { ...match.votes },
      teams: match.teams.map((t) => ({
        groupId: t.groupId,
        cooldown: timer(t.cooldown),
        guessVersion: t.guessVersion,
      })),
    };
  if (viewer.kind !== "player") return null;
  const side = teamOf(match, viewer.playerId);
  if (side === null) return null;
  const own = match.teams[side];
  const revealAll = isTerminal(match);
  return {
    matchId: match.id,
    characters: match.teams.map((t, i) => ({
      groupId: t.groupId,
      character:
        revealAll || (i === side && match.phase === "PLAYING") ? face(t.characterId) : null,
    })),
    votes: null,
    teams: [
      { groupId: own.groupId, cooldown: timer(own.cooldown), guessVersion: own.guessVersion },
    ],
  };
}

/** Explicit per-viewer projection. Never returns shared objects, pools or aliases. */
export function viewFor({
  shared,
  viewer,
}: {
  config: GuessConfig;
  shared: GuessShared;
  viewer: Viewer;
  viewerGroupId: GroupId | null;
}): GuessView {
  const host = viewer.kind === "host";
  const playerId: PlayerId | null = viewer.kind === "player" ? viewer.playerId : null;
  const own = playerId ? shared.matches.find((m) => teamOf(m, playerId) !== null) : undefined;
  const allOver = shared.matches.length > 0 && shared.matches.every(isTerminal);
  const issue = allOver
    ? validateGroups(shared.groups.map((g) => ({ groupId: g.groupId, playerIds: g.members })))
    : null;
  return {
    round: shared.round,
    categories: categoryOptions(),
    matches: shared.matches.map(publicMatch),
    ownMatchId: own?.id ?? null,
    privateMatches: host
      ? shared.matches.map((m) => privateMatch(m, viewer)!)
      : own
        ? [privateMatch(own, viewer)!]
        : [],
    myVote: own && playerId ? (own.votes[playerId] ?? null) : null,
    canStart: host && canStartRound(shared),
    canNewRound: host && allOver && issue === null,
    newRoundIssue: host ? issue : null,
  };
}
