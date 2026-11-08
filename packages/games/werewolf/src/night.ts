import type { PlayerId } from "@cangsplayground/core";
import type { Context, Reducer } from "./context.js";
import { deadlineFor } from "./deadline.js";
import { targetPayload } from "./payloads.js";
import { livingIds, livingPlayer, livingWith, rolesOf } from "./players.js";
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
 * - `ww:seerPick {targetId}`: the Seer inspects another living player; the first pick is locked.
 * - `ww:guardPick {targetId}`: the Guard protects any living player; self-protection only once per game.
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
    if (!actor || !parsed.success || shared.seerPick !== null || parsed.data.targetId === actor) return null;
    const target = livingPlayer(shared, parsed.data.targetId);
    if (!target) return null;
    shared.seerPick = parsed.data.targetId;
    shared.seerLog.push({ night: shared.night, targetId: parsed.data.targetId, isWerewolf: target.role === "werewolf" });
    return shared;
  },
  "ww:guardPick": (shared, ctx, payload) => {
    const actor = nightActor(shared, ctx, "guard");
    const parsed = targetPayload.safeParse(payload);
    if (!actor || !parsed.success || !livingPlayer(shared, parsed.data.targetId)) return null;
    if (parsed.data.targetId === actor && shared.guardSelfUsed) return null;
    shared.guardPick = parsed.data.targetId;
    return shared;
  },
};

/** Begins the next night: bumps the counter, clears last night's picks and schedules the night deadline. */
export function startNight(shared: WerewolfShared, ctx: Pick<Context, "config" | "now">): void {
  shared.night += 1;
  shared.stage = "NIGHT";
  shared.wolfVotes = {};
  shared.seerPick = null;
  shared.guardPick = null;
  shared.dawn = null;
  shared.dayVotes = {};
  shared.deadline = deadlineFor("NIGHT", shared.night, ctx.now + ctx.config.nightSeconds * 1000);
}

/**
 * Resolves the night when its timer ends: picks the wolves' victim (tie -> random, no votes -> none),
 * lets a Guard protection cancel it, records the dawn result and runs the win check. The winner stays
 * in `pendingWinner` so the kill animation plays before anyone is told the game is over.
 */
export function resolveDawn(shared: WerewolfShared, ctx: Pick<Context, "now" | "rng">): void {
  const roles = rolesOf(shared);
  const living = new Set(livingIds(shared));
  const wolfVotes = Object.fromEntries(
    Object.entries(shared.wolfVotes).filter(([voter, target]) => living.has(voter) && living.has(target)),
  );
  const guardId = livingWith(shared, "guard");
  if (guardId !== undefined && shared.guardPick === guardId) shared.guardSelfUsed = true;
  const victim = resolveNight(pickWolfTarget(wolfVotes, ctx.rng), guardId === undefined ? null : shared.guardPick);
  if (victim !== null) shared.players[victim]!.alive = false;
  shared.dawn = { eliminatedId: victim };
  shared.pendingWinner = checkWinner(roles, livingIds(shared));
  shared.stage = "DAWN";
  shared.deadline = deadlineFor("DAWN", shared.night, ctx.now + DAWN_MS);
}
