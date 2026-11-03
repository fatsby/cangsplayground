import {
  createRng,
  type GameAction,
  type GroupContext,
  type PlayerId,
  type RosterEntry,
} from "@cangsplayground/core";
import { reduceAction } from "../src/actions.js";
import { advancePhase, deadlines, expireDeadline } from "../src/clock.js";
import { configSchema, type MurderConfig } from "../src/config.js";
import { handlePlayerLeft, handleRosterChange } from "../src/lifecycle.js";
import type { CaseLogic } from "../src/model.js";
import { prepareCase } from "../src/round.js";
import { availableActions } from "../src/solver.js";
import type { MurderShared } from "../src/types.js";

/** A running test session: state, config and a controllable server clock. */
export type Harness = {
  readonly shared: MurderShared;
  readonly config: MurderConfig;
  readonly now: number;
  /** Live roster used for commands that read it (New case). Tests may edit it. */
  readonly roster: RosterEntry[];
  /** Moves a READY case to INTRO directly, bypassing the command layer. */
  begin(): void;
  /** Advances to the next phase or round at the current time, like the host's Next. */
  next(): void;
  /** Moves the server clock forward. */
  tick(ms: number): void;
  /** Settles every deadline that is due, the way the lobby does before each command. */
  expireDue(): void;
  /** Sends a host command; the current PhaseGuard is attached unless `payload` overrides it. */
  host(type: string, payload?: Record<string, unknown>): boolean;
  /** Marks a player offline in the roster and runs the roster-change hook. */
  disconnect(id: PlayerId): void;
  /** Marks a player online again and runs the roster-change hook. */
  reconnect(id: PlayerId): void;
  /** Removes a player for good (leave or kick) and runs the player-left hook. */
  leave(id: PlayerId): void;
  /** Sends a player command with the same defaults. */
  player(id: PlayerId, type: string, payload?: Record<string, unknown>): boolean;
};

/** Players are named `g1p1`, `g1p2`, ... per group `g1`, `g2`, ...; seed 1, time 1000. */
export function groupsOf(sizes: readonly number[]): GroupContext[] {
  return sizes.map((size, index) => ({
    groupId: `g${index + 1}`,
    playerIds: Array.from({ length: size }, (_, k) => `g${index + 1}p${k + 1}`),
    round: 1,
  }));
}

/**
 * Prepares a case for groups of the given sizes and returns a harness around it.
 *
 * Commands settle due deadlines first, then reduce against the settled state, mirroring how
 * the lobby orders them. Rejected commands leave `shared` untouched (same reference).
 *
 * @param sizes members per group, e.g. `[3, 4]`.
 * @param overrides phase lengths to override, in seconds.
 * @param seed seed of the session random stream (default 1).
 */
export function start(
  sizes: readonly number[],
  overrides: Partial<MurderConfig> = {},
  seed = 1,
): Harness {
  const config = configSchema.parse(overrides);
  const groups = groupsOf(sizes);
  const rng = createRng(seed);
  let shared = prepareCase(groups, 1, rng);
  let now = 1000;
  const roster: RosterEntry[] = groups.flatMap((g) =>
    g.playerIds.map((playerId) => ({ playerId, groupId: g.groupId, connected: true })),
  );
  const expireDue = () => {
    for (const deadline of deadlines(shared)) {
      if (now >= deadline.endsAt) {
        const advanced = expireDeadline(shared, deadline, config, now);
        if (advanced) shared = advanced;
      }
    }
  };
  const send = (actor: Parameters<typeof reduceAction>[2], type: string, payload: object) => {
    expireDue();
    const action: GameAction = {
      type,
      payload: {
        caseInstanceId: shared.caseInstanceId,
        caseNumber: shared.caseNumber,
        phaseVersion: shared.phaseVersion,
        ...payload,
      },
    };
    const result = reduceAction(shared, { config, roster, now, rng }, actor, action);
    if (!result) return false;
    shared = result;
    return true;
  };
  return {
    get shared() {
      return shared;
    },
    config,
    get now() {
      return now;
    },
    roster,
    begin() {
      shared = advancePhase(shared, config, now);
    },
    next() {
      shared = advancePhase(shared, config, now);
    },
    tick(ms) {
      now += ms;
    },
    expireDue,
    disconnect(id) {
      roster.find((entry) => entry.playerId === id)!.connected = false;
      shared = handleRosterChange({ config, shared, roster, now, rng });
    },
    reconnect(id) {
      roster.find((entry) => entry.playerId === id)!.connected = true;
      shared = handleRosterChange({ config, shared, roster, now, rng });
    },
    leave(id) {
      const index = roster.findIndex((entry) => entry.playerId === id);
      const groupId = roster[index]?.groupId ?? null;
      if (index >= 0) roster.splice(index, 1);
      shared = handlePlayerLeft({ config, shared, roster, now, rng, playerId: id, groupId });
    },
    host: (type, payload = {}) => send({ kind: "host" }, type, payload),
    player: (id, type, payload = {}) => send({ kind: "player", playerId: id }, type, payload),
  };
}

/** Every ordered sequence of four offered investigations of a case (all valid routes). */
export function allRoutes(logic: CaseLogic): string[][] {
  const routes: string[][] = [];
  const walk = (used: string[]) => {
    const known = [
      ...logic.initialCardIds,
      ...used.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
    ];
    if (used.length === 4) {
      routes.push(used);
      return;
    }
    for (const action of availableActions(logic, used, known)) walk([...used, action.id]);
  };
  walk([]);
  return routes;
}

/** Cards a team holds after playing `route`: the starting cards plus every result. */
export function cardsAfter(logic: CaseLogic, route: readonly string[]): string[] {
  return [
    ...logic.initialCardIds,
    ...route.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
  ];
}

/** Brings a harness to the first investigation round (Start, then Next x3). */
export function toInvestigation(h: Harness): void {
  h.host("mm:start");
  h.host("mm:next");
  h.host("mm:next");
  h.host("mm:next");
}

/** The member who leads the current investigation round of a team. */
export function leadOf(h: Harness, groupId = "g1"): PlayerId {
  const team = h.shared.teams.find((t) => t.groupId === groupId)!;
  return team.leadOrder[h.shared.investigationRound - 1]!;
}
