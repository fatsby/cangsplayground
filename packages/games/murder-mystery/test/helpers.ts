import { createRng, type GroupContext } from "@cangsplayground/core";
import { advancePhase, deadlines, expireDeadline } from "../src/clock.js";
import { configSchema, type MurderConfig } from "../src/config.js";
import { prepareCase } from "../src/round.js";
import type { MurderShared } from "../src/types.js";

/** A running test session: state, config and a controllable server clock. */
export type Harness = {
  readonly shared: MurderShared;
  readonly config: MurderConfig;
  readonly now: number;
  /** Moves a READY case to INTRO (the command layer arrives in a later task). */
  begin(): void;
  /** Advances to the next phase or round at the current time, like the host's Next. */
  next(): void;
  /** Moves the server clock forward. */
  tick(ms: number): void;
  /** Settles every deadline that is due, the way the lobby does before each command. */
  expireDue(): void;
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
 * @param sizes members per group, e.g. `[3, 4]`.
 * @param overrides phase lengths to override, in seconds.
 */
export function start(sizes: readonly number[], overrides: Partial<MurderConfig> = {}): Harness {
  const config = configSchema.parse(overrides);
  let shared = prepareCase(groupsOf(sizes), 1, createRng(1));
  let now = 1000;
  return {
    get shared() {
      return shared;
    },
    config,
    get now() {
      return now;
    },
    begin() {
      shared = advancePhase(shared, config, now);
    },
    next() {
      shared = advancePhase(shared, config, now);
    },
    tick(ms) {
      now += ms;
    },
    expireDue() {
      for (const deadline of deadlines(shared)) {
        if (now >= deadline.endsAt) {
          const advanced = expireDeadline(shared, deadline, config, now);
          if (advanced) shared = advanced;
        }
      }
    },
  };
}
