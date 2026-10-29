import type {
  PlayerId,
  RosterEntry,
  SharedArgs,
  SharedDeadline,
  TimerState,
} from "@cangsplayground/core";
import { categoryById } from "./content.js";
import type { GuessConfig, GuessMatch, GuessShared, MatchTeam, PauseReason } from "./types.js";

/** Everything a rule needs except the state it mutates. */
export type Ctx = Omit<SharedArgs<GuessConfig, GuessShared>, "shared">;

export function idleTimer(durationMs = 0): TimerState {
  return { endsAt: null, pausedRemainingMs: null, durationMs };
}
function runningTimer(durationMs: number, now: number): TimerState {
  return { endsAt: now + durationMs, pausedRemainingMs: null, durationMs };
}

export function isTerminal(match: GuessMatch): boolean {
  return match.phase === "FINISHED" || match.phase === "ENDED";
}

export function teamOf(match: GuessMatch, playerId: PlayerId): 0 | 1 | null {
  if (match.teams[0].members.includes(playerId)) return 0;
  if (match.teams[1].members.includes(playerId)) return 1;
  return null;
}

function connected(roster: readonly RosterEntry[], playerId: PlayerId): boolean {
  return roster.some((r) => r.playerId === playerId && r.connected);
}

export function connectedCount(team: MatchTeam, roster: readonly RosterEntry[]): number {
  return team.members.filter((id) => connected(roster, id)).length;
}

/** The next connected member at or after nextIndex, in the team's fixed order. */
function candidate(team: MatchTeam, roster: readonly RosterEntry[]) {
  const n = team.members.length;
  for (let step = 0; step < n; step++) {
    const index = (team.nextIndex + step) % n;
    if (connected(roster, team.members[index]!)) return { id: team.members[index]!, index };
  }
  return null;
}

function consume(team: MatchTeam, index: number): PlayerId {
  team.nextIndex = (index + 1) % team.members.length;
  return team.members[index]!;
}

/** Recomputes the cached, roster-derived public fields. */
export function refreshMatch(match: GuessMatch, roster: readonly RosterEntry[]): void {
  match.connectedCounts = [
    connectedCount(match.teams[0], roster),
    connectedCount(match.teams[1], roster),
  ];
  match.nextSpeakerId =
    match.phase === "PLAYING"
      ? (candidate(match.teams[match.askingTeam === 0 ? 1 : 0], roster)?.id ?? null)
      : null;
}
export function refreshAll(shared: GuessShared, roster: readonly RosterEntry[]): void {
  for (const match of shared.matches) refreshMatch(match, roster);
}

export function pauseMatch(match: GuessMatch, now: number, reason: PauseReason): void {
  if (match.paused) return;
  const { timer } = match;
  if (timer.endsAt !== null) {
    timer.pausedRemainingMs = Math.max(0, timer.endsAt - now);
    timer.endsAt = null;
  }
  for (const team of match.teams) {
    const cd = team.cooldown;
    if (cd.endsAt === null) continue;
    const left = cd.endsAt - now;
    team.cooldown =
      left > 0 ? { ...cd, endsAt: null, pausedRemainingMs: left } : idleTimer(cd.durationMs);
  }
  match.paused = true;
  match.pauseReason = reason;
  match.phaseVersion++;
}

export function resumeMatch(match: GuessMatch, now: number): void {
  if (!match.paused) return;
  const { timer } = match;
  if (timer.pausedRemainingMs !== null) {
    timer.endsAt = now + timer.pausedRemainingMs;
    timer.pausedRemainingMs = null;
  }
  for (const team of match.teams) {
    const cd = team.cooldown;
    if (cd.pausedRemainingMs !== null)
      team.cooldown = { ...cd, endsAt: now + cd.pausedRemainingMs, pausedRemainingMs: null };
  }
  match.paused = false;
  match.pauseReason = null;
  match.phaseVersion++;
}

export function finishMatch(
  match: GuessMatch,
  outcome: { winner: string } | { reason: "host" | "empty-group" },
): void {
  match.phase = "winner" in outcome ? "FINISHED" : "ENDED";
  match.winnerGroupId = "winner" in outcome ? outcome.winner : null;
  match.endReason = "reason" in outcome ? outcome.reason : null;
  match.timer = idleTimer(match.timer.durationMs);
  for (const team of match.teams) team.cooldown = idleTimer(team.cooldown.durationMs);
  match.paused = false;
  match.pauseReason = null;
  match.speakerId = null;
  match.nextSpeakerId = null;
  match.phaseVersion++;
}

export function startVote(match: GuessMatch, ctx: Ctx): void {
  match.phase = "CATEGORY_VOTE";
  match.phaseVersion++;
  match.votes = {};
  match.timer = runningTimer(ctx.config.voteSeconds * 1000, ctx.now);
}

/**
 * Opens a new question slot for `side`. Without a connected member on either team the
 * slot waits, paused for the host, with its full time and the candidate unconsumed.
 */
export function beginTurn(match: GuessMatch, side: 0 | 1, ctx: Ctx): void {
  match.askingTeam = side;
  match.turnId++;
  match.timer = runningTimer(ctx.config.turnSeconds * 1000, ctx.now);
  const next = candidate(match.teams[side], ctx.roster);
  const other = connectedCount(match.teams[side === 0 ? 1 : 0], ctx.roster);
  if (!next || other === 0) {
    match.speakerId = null;
    pauseMatch(match, ctx.now, "offline");
  } else match.speakerId = consume(match.teams[side], next.index);
  refreshMatch(match, ctx.roster);
}

/** The single path from one question to the next (timer, I'm done, skip, leave). */
export function advanceTurn(match: GuessMatch, ctx: Ctx): void {
  beginTurn(match, match.askingTeam === 0 ? 1 : 0, ctx);
}

/** Fills a waiting slot (speakerId null) from the asking team without a new turn. */
export function fillSpeaker(match: GuessMatch, roster: readonly RosterEntry[]): boolean {
  const team = match.teams[match.askingTeam];
  const next = candidate(team, roster);
  if (!next) return false;
  match.speakerId = consume(team, next.index);
  return true;
}

export function isOnline(roster: readonly RosterEntry[], playerId: PlayerId | null): boolean {
  return playerId !== null && connected(roster, playerId);
}

/** Closes the vote: most votes wins, ties (or no votes) are random among the leaders. */
export function closeCategoryVote(match: GuessMatch, ctx: Ctx, categoryIds: readonly string[]) {
  const counts = new Map(categoryIds.map((id) => [id, 0]));
  const members = new Set([...match.teams[0].members, ...match.teams[1].members]);
  for (const [playerId, categoryId] of Object.entries(match.votes))
    if (members.has(playerId) && counts.has(categoryId))
      counts.set(categoryId, counts.get(categoryId)! + 1);
  const top = Math.max(...counts.values());
  const leaders = categoryIds.filter((id) => counts.get(id) === top);
  const categoryId = leaders[ctx.rng.int(leaders.length)]!;
  const pool = [...categoryById(categoryId).characterIds];
  const first = pool.splice(ctx.rng.int(pool.length), 1)[0]!;
  const second = pool[ctx.rng.int(pool.length)]!;
  match.categoryId = categoryId;
  match.teams[0].characterId = first;
  match.teams[1].characterId = second;
  for (const team of match.teams) team.cooldown = idleTimer(ctx.config.cooldownSeconds * 1000);
  match.phase = "PLAYING";
  match.phaseVersion++;
  beginTurn(match, match.askingTeam, ctx);
}

export function deadlineKey(round: number, match: GuessMatch): string {
  return `r${round}:${match.id}:${match.phase}:v${match.phaseVersion}:t${match.turnId}`;
}

export function deadlines(shared: GuessShared): SharedDeadline[] {
  return shared.matches.flatMap((match) =>
    (match.phase === "CATEGORY_VOTE" || match.phase === "PLAYING") &&
    !match.paused &&
    match.timer.endsAt !== null
      ? [{ key: deadlineKey(shared.round, match), endsAt: match.timer.endsAt }]
      : [],
  );
}

/** Applies one due deadline; null when it no longer matches the state. */
export function expireDeadline(
  shared: GuessShared,
  deadline: SharedDeadline,
  ctx: Ctx,
  categoryIds: readonly string[],
): GuessShared | null {
  const index = shared.matches.findIndex(
    (m) =>
      deadlineKey(shared.round, m) === deadline.key &&
      !m.paused &&
      m.timer.endsAt === deadline.endsAt &&
      ctx.now >= deadline.endsAt,
  );
  if (index < 0) return null;
  const next = structuredClone(shared);
  const match = next.matches[index]!;
  if (match.phase === "CATEGORY_VOTE") closeCategoryVote(match, ctx, categoryIds);
  else if (match.phase === "PLAYING") advanceTurn(match, ctx);
  else return null;
  refreshAll(next, ctx.roster);
  return next;
}
