import { z } from "zod";
import type { GameAction, Viewer } from "@cangsplayground/core";
import { categories, isCategoryId, matchesCharacter, normalizeGuess } from "./content.js";
import {
  advanceTurn,
  beginTurn,
  fillSpeaker,
  finishMatch,
  isOnline,
  isTerminal,
  pauseMatch,
  refreshAll,
  resumeMatch,
  startVote,
  teamOf,
  connectedCount,
  type Ctx,
} from "./match.js";
import { newRound } from "./lifecycle.js";
import { GUESS_MAX, type ControlGuard, type GuessMatch, type GuessShared } from "./types.js";

export type ActionCtx = Ctx & { actor: Viewer };
type Reducer = (shared: GuessShared, ctx: ActionCtx, payload: unknown) => GuessShared | null;

const int = z.number().int().min(0);
const matchGuard = z.object({ round: int, matchId: z.string().min(1).max(64), phaseVersion: int });
const controlGuard = matchGuard.extend({ turnId: int.nullable() });
const roundPayload = z.object({ round: int });
const votePayload = matchGuard.extend({ categoryId: z.string().min(1).max(64) });
const donePayload = matchGuard.extend({ turnId: int });
const guessPayload = matchGuard.extend({ guessVersion: int, name: z.string().max(400) });
const allPayload = z.object({ round: int, matches: z.array(controlGuard).min(1).max(64) });

/** Start is for round 1: some match READY and none voting or playing. */
export function canStartRound(shared: GuessShared): boolean {
  return (
    shared.matches.some((m) => m.phase === "READY") &&
    shared.matches.every((m) => m.phase === "READY" || isTerminal(m))
  );
}

export const CATEGORY_IDS = categories().map((c) => c.id);

function findMatch(shared: GuessShared, guard: z.infer<typeof matchGuard>): GuessMatch | undefined {
  if (guard.round !== shared.round) return undefined;
  const match = shared.matches.find((m) => m.id === guard.matchId);
  return match?.phaseVersion === guard.phaseVersion ? match : undefined;
}

function controlled(shared: GuessShared, guard: ControlGuard): GuessMatch | undefined {
  const match = findMatch(shared, guard);
  return match && match.turnId === guard.turnId ? match : undefined;
}

function playerMatch(
  shared: GuessShared,
  ctx: ActionCtx,
  payload: unknown,
  schema: z.ZodType<z.infer<typeof matchGuard>>,
) {
  if (ctx.actor.kind !== "player") return null;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return null;
  const match = findMatch(shared, parsed.data);
  if (!match) return null;
  const side = teamOf(match, ctx.actor.playerId);
  return side === null ? null : { match, side, playerId: ctx.actor.playerId };
}

/** A trimmed name of 1–80 code points that does not normalize to nothing. */
function validName(name: string): string | null {
  const trimmed = name.trim();
  const length = [...trimmed].length;
  return length >= 1 && length <= GUESS_MAX && normalizeGuess(trimmed) ? trimmed : null;
}

function pause(match: GuessMatch, ctx: ActionCtx): boolean {
  if ((match.phase !== "CATEGORY_VOTE" && match.phase !== "PLAYING") || match.paused) return false;
  pauseMatch(match, ctx.now, "host");
  return true;
}

function resume(match: GuessMatch, ctx: ActionCtx): boolean {
  if ((match.phase !== "CATEGORY_VOTE" && match.phase !== "PLAYING") || !match.paused) return false;
  if (match.phase === "PLAYING") {
    if (match.teams.some((team) => connectedCount(team, ctx.roster) === 0)) return false;
    resumeMatch(match, ctx.now);
    if (match.speakerId === null) fillSpeaker(match, ctx.roster);
    else if (!isOnline(ctx.roster, match.speakerId)) beginTurn(match, match.askingTeam, ctx);
  } else resumeMatch(match, ctx.now);
  return true;
}

const hostOnly =
  (schema: typeof controlGuard, apply: (match: GuessMatch, ctx: ActionCtx) => boolean): Reducer =>
  (shared, ctx, payload) => {
    if (ctx.actor.kind !== "host") return null;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return null;
    const match = controlled(shared, parsed.data);
    return match && apply(match, ctx) ? shared : null;
  };

const allMatches =
  (apply: (match: GuessMatch, ctx: ActionCtx) => boolean): Reducer =>
  (shared, ctx, payload) => {
    if (ctx.actor.kind !== "host") return null;
    const parsed = allPayload.safeParse(payload);
    if (!parsed.success || parsed.data.round !== shared.round) return null;
    let applied = 0;
    for (const guard of parsed.data.matches) {
      const match = controlled(shared, { ...guard, round: parsed.data.round });
      if (match && apply(match, ctx)) applied++;
    }
    return applied ? shared : null;
  };

export const ACTIONS: Record<string, Reducer> = {
  "gc:start": (shared, ctx, payload) => {
    const parsed = roundPayload.safeParse(payload);
    if (
      ctx.actor.kind !== "host" ||
      !parsed.success ||
      parsed.data.round !== shared.round ||
      !canStartRound(shared)
    )
      return null;
    // A match that already ended (a team left before Start) stays ended.
    for (const match of shared.matches) if (match.phase === "READY") startVote(match, ctx);
    return shared;
  },
  "gc:vote": (shared, ctx, payload) => {
    const found = playerMatch(shared, ctx, payload, votePayload);
    const parsed = votePayload.safeParse(payload);
    if (!found || !parsed.success || !isCategoryId(parsed.data.categoryId)) return null;
    const { match, playerId } = found;
    if (
      match.phase !== "CATEGORY_VOTE" ||
      match.paused ||
      match.timer.endsAt === null ||
      ctx.now >= match.timer.endsAt
    )
      return null;
    match.votes[playerId] = parsed.data.categoryId;
    return shared;
  },
  "gc:done": (shared, ctx, payload) => {
    const found = playerMatch(shared, ctx, payload, donePayload);
    const parsed = donePayload.safeParse(payload);
    if (!found || !parsed.success) return null;
    const { match, playerId } = found;
    if (
      match.phase !== "PLAYING" ||
      match.paused ||
      match.turnId !== parsed.data.turnId ||
      match.speakerId !== playerId
    )
      return null;
    advanceTurn(match, ctx);
    return shared;
  },
  "gc:guess": (shared, ctx, payload) => {
    const found = playerMatch(shared, ctx, payload, guessPayload);
    const parsed = guessPayload.safeParse(payload);
    if (!found || !parsed.success) return null;
    const { match, side } = found;
    const team = match.teams[side];
    const opponent = match.teams[side === 0 ? 1 : 0];
    const name = validName(parsed.data.name);
    if (
      match.phase !== "PLAYING" ||
      match.paused ||
      team.guessVersion !== parsed.data.guessVersion ||
      (team.cooldown.endsAt !== null && ctx.now < team.cooldown.endsAt) ||
      team.cooldown.pausedRemainingMs !== null ||
      !name ||
      !opponent.characterId
    )
      return null;
    team.guessVersion++;
    if (matchesCharacter(name, opponent.characterId)) finishMatch(match, { winner: team.groupId });
    else {
      const durationMs = ctx.config.cooldownSeconds * 1000;
      team.cooldown = { endsAt: ctx.now + durationMs, pausedRemainingMs: null, durationMs };
    }
    return shared;
  },
  "gc:pause": hostOnly(controlGuard, pause),
  "gc:resume": hostOnly(controlGuard, resume),
  "gc:skip": hostOnly(controlGuard, (match, ctx) => {
    if (match.phase !== "PLAYING" || match.paused) return false;
    advanceTurn(match, ctx);
    return true;
  }),
  "gc:end": hostOnly(controlGuard, (match) => {
    if (isTerminal(match)) return false;
    finishMatch(match, { reason: "host" });
    return true;
  }),
  "gc:pauseAll": allMatches(pause),
  "gc:resumeAll": allMatches(resume),
  "gc:newRound": (shared, ctx, payload) => {
    const parsed = roundPayload.safeParse(payload);
    if (ctx.actor.kind !== "host" || !parsed.success || parsed.data.round !== shared.round)
      return null;
    return newRound({ ...ctx, shared });
  },
};

/** Validates and applies one action on a copy; null rejects it. */
export function reduceAction(shared: GuessShared, ctx: Ctx, actor: Viewer, action: GameAction) {
  if (!Object.hasOwn(ACTIONS, action.type)) return null;
  const next = ACTIONS[action.type]!(structuredClone(shared), { ...ctx, actor }, action.payload);
  if (next) refreshAll(next, ctx.roster);
  return next;
}
