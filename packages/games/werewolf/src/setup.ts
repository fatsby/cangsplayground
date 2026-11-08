import { z } from "zod";
import type { PlayerId } from "@cangsplayground/core";
import { isHost, type Reducer } from "./context.js";
import { deadlineFor } from "./deadline.js";
import { rolesOf } from "./players.js";
import { endsGameOnEntry } from "./roster.js";
import { validateRoles } from "./rules.js";
import type { WerewolfShared } from "./WerewolfShared.js";
import { REVEAL_MS, ROLES, type Role } from "./types.js";

const setRolePayload = z.object({ playerId: z.string().min(1), role: z.enum(ROLES) });

/** The state a fresh game starts in: everyone alive, roles dealt, nothing scheduled. */
export function initialShared(playerIds: readonly PlayerId[], roles: Record<PlayerId, Role>): WerewolfShared {
  return {
    stage: "SETUP",
    night: 0,
    deadline: null,
    players: Object.fromEntries(playerIds.map((id) => [id, { role: roles[id]!, alive: true, pending: false }])),
    order: [...playerIds],
    wolfVotes: {},
    seerPick: null,
    guardPick: null,
    guardSelfUsed: false,
    seerLog: [],
    dawn: null,
    dayVotes: {},
    lastVote: null,
    winner: null,
    pendingWinner: null,
  };
}

/**
 * Host actions available before the game starts.
 * - `ww:setRole {playerId, role}`: change one player's role (SETUP), or a waiting late joiner's role
 *   (any stage, unless entering with that role would end the game on the spot).
 * - `ww:start`: validate the roles and begin the role-reveal period.
 */
export const setupActions: Record<string, Reducer> = {
  "ww:setRole": (shared, ctx, payload) => {
    const parsed = setRolePayload.safeParse(payload);
    const target = parsed.success ? shared.players[parsed.data.playerId] : undefined;
    if (!isHost(ctx) || !parsed.success || !target) return null;
    const editable = shared.stage === "SETUP" || (target.pending && shared.stage !== "ENDED");
    if (!editable) return null;
    if (target.pending && endsGameOnEntry(shared, parsed.data.playerId, parsed.data.role)) return null;
    target.role = parsed.data.role;
    return shared;
  },
  "ww:start": (shared, ctx) => {
    if (!isHost(ctx) || shared.stage !== "SETUP" || validateRoles(rolesOf(shared)) !== null) return null;
    shared.stage = "REVEAL";
    shared.deadline = deadlineFor("REVEAL", 0, ctx.now + REVEAL_MS);
    return shared;
  },
};
