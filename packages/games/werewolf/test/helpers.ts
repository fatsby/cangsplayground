import { createRng, type GameAction, type PlayerId, type Viewer } from "@cangsplayground/core";
import werewolf from "../src/index.js";
import type { WerewolfShared } from "../src/WerewolfShared.js";
import { configSchema, type Role } from "../src/types.js";

export const HOST: Viewer = { kind: "host" };
export const player = (playerId: PlayerId): Viewer => ({ kind: "player", playerId });
export const config = configSchema.parse({});

/** Player ids p1..pN, in the order roles are given. */
export const idsFor = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** A freshly prepared (SETUP) game with p1..pN holding `roles` in order. */
export function setupShared(roles: Role[], now = 0): WerewolfShared {
  const ids = idsFor(roles.length);
  const base = werewolf.prepareShared!({
    config,
    groups: [{ groupId: "g1", playerIds: ids, round: 1 }],
    rng: createRng(1),
    now,
  }) as WerewolfShared;
  roles.forEach((role, i) => {
    base.players[ids[i]!]!.role = role;
  });
  return base;
}

/** Runs one player/host action through the module exactly as the lobby would. */
export function act(
  shared: WerewolfShared,
  actor: Viewer,
  type: string,
  payload?: unknown,
  now = 0,
  seed = 1,
): WerewolfShared | null {
  const action: GameAction = payload === undefined ? { type } : { type, payload };
  return werewolf.onSharedAction!({
    config,
    shared,
    roster: idsFor(Object.keys(shared.players).length).map((id) => ({ playerId: id, groupId: "g1", connected: true })),
    now,
    rng: createRng(seed),
    action,
    actor,
  });
}

/** Fires the deadline the module currently exports, at `now` (defaults to exactly the deadline). */
export function fire(shared: WerewolfShared, now?: number, seed = 1): WerewolfShared {
  const deadlines = werewolf.sharedDeadlines!({
    config,
    shared,
    roster: [],
    now: now ?? 0,
    rng: createRng(seed),
  });
  if (deadlines.length !== 1) throw new Error(`expected exactly one deadline, got ${deadlines.length}`);
  const at = now ?? deadlines[0]!.endsAt;
  const next = werewolf.onSharedDeadline!({
    config,
    shared,
    roster: [],
    now: at,
    rng: createRng(seed),
    deadline: deadlines[0]!,
  });
  if (next === null) throw new Error("deadline had no effect");
  return next;
}
