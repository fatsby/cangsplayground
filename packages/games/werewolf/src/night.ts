import type { PlayerId } from "@cangsplayground/core";
import type { Context, Reducer } from "./context.js";
import { scheduleStage } from "./deadline.js";
import { targetPayload } from "./payloads.js";
import { livingIds, livingPlayer, livingWith, rolesOf } from "./players.js";
import { activatePending } from "./roster.js";
import { checkWinner, pickWolfTarget, resolveNight } from "./rules.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import { DAWN_MS, type Role } from "./types.js";

/** The acting player's id when they are a living, non-pending `role` and it is night; otherwise null. */
function nightActor(shared: WerewolfShared, ctx: Context, role: Role): PlayerId | null {
  if (shared.stage !== "NIGHT" || ctx.actor.kind !== "player") return null;
  const id = ctx.actor.playerId;
  return livingPlayer(shared, id)?.role === role ? id : null;
}

/**
 * Night actions (all simultaneous and secret, resolved only when the night timer ends).
 * - `ww:wolfVote {targetId}`: a werewolf votes for a living non-werewolf; can be changed until dawn.
 * - `ww:seerPick {targetId}`: a Seer inspects another living player; each Seer's first pick is locked.
 * - `ww:guardPick {targetId}`: a Guard protects any living player; each Guard may protect themselves once per game.
 */
export const nightActions: Record<string, Reducer> = {
  "ww:wolfVote": (shared, ctx, payload) => {
    const actor = nightActor(shared, ctx, "werewolf");
    const parsed = targetPayload.safeParse(payload);
    if (!actor || !parsed.success) return null;
    const target = livingPlayer(shared, parsed.data.targetId);
    if (!target || target.role === "werewolf") return null;
    shared.wolfVotes[actor] = parsed.data.targetId;
    return shared;
  },
  "ww:seerPick": (shared, ctx, payload) => {
    const actor = nightActor(shared, ctx, "seer");
    const parsed = targetPayload.safeParse(payload);
    if (!actor || !parsed.success || actor in shared.seerPicks || parsed.data.targetId === actor)
      return null;
    const target = livingPlayer(shared, parsed.data.targetId);
    if (!target) return null;
    shared.seerPicks[actor] = parsed.data.targetId;
    shared.seerLog.push({
      seerId: actor,
      night: shared.night,
      targetId: parsed.data.targetId,
      isWerewolf: target.role === "werewolf",
    });
    return shared;
  },
  "ww:guardPick": (shared, ctx, payload) => {
    const actor = nightActor(shared, ctx, "guard");
    const parsed = targetPayload.safeParse(payload);
    if (!actor || !parsed.success || !livingPlayer(shared, parsed.data.targetId)) return null;
    if (parsed.data.targetId === actor && shared.guardSelfUsed.includes(actor)) return null;
    shared.guardPicks[actor] = parsed.data.targetId;
    return shared;
  },
};

/** Begins the next night: bumps the counter, clears last night's picks and schedules the night deadline. */
export function startNight(shared: WerewolfShared, ctx: Pick<Context, "config" | "now">): void {
  shared.night += 1;
  shared.stage = "NIGHT";
  shared.wolfVotes = {};
  shared.seerPicks = {};
  shared.guardPicks = {};
  shared.dawn = null;
  shared.dayVotes = {};
  scheduleStage(shared, "NIGHT", ctx.now, ctx.config.nightSeconds * 1000);
}

/**
 * Resolves the night when its timer ends: picks the wolves' victim (tie -> random, no votes -> none),
 * lets a Guard protection cancel it, records the dawn result and runs the win check. The winner stays
 * in `pendingWinner` so the kill animation plays before anyone is told the game is over.
 */
export function resolveDawn(shared: WerewolfShared, ctx: Pick<Context, "now" | "rng">): void {
  const living = new Set(livingIds(shared));
  const wolfVotes = Object.fromEntries(
    Object.entries(shared.wolfVotes).filter(
      ([voter, target]) => living.has(voter) && living.has(target),
    ),
  );
  // Every living Guard protects whoever they chose; a self-protection is spent for good.
  const protections = livingWith(shared, "guard").flatMap((guard) => {
    const pick = shared.guardPicks[guard];
    if (pick === undefined) return [];
    if (pick === guard && !shared.guardSelfUsed.includes(guard)) shared.guardSelfUsed.push(guard);
    return [pick];
  });
  activatePending(shared);
  const victim = protections.reduce<PlayerId | null>(
    (target, protectedId) => resolveNight(target, protectedId),
    pickWolfTarget(wolfVotes, ctx.rng),
  );
  if (victim !== null) shared.players[victim]!.alive = false;
  shared.dawn = { eliminatedId: victim };
  shared.pendingWinner = checkWinner(rolesOf(shared), livingIds(shared));
  shared.stage = "DAWN";
  scheduleStage(shared, "DAWN", ctx.now, DAWN_MS);
}
