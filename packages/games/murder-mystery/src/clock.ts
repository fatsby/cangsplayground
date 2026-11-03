import type { SharedDeadline, TimerState } from "@cangsplayground/core";
import type { MurderConfig } from "./config.js";
import type { Clock, MurderShared, Phase } from "./types.js";

/** Fixed length of the projector intro; not configurable and outside the timed minutes. */
export const INTRO_MS = 13000;

/** Investigation rounds every team plays; the lead order has one entry per round. */
export const INVESTIGATION_ROUNDS = 4;

const MS_PER_SECOND = 1000;

/** The clock of a phase that has no timer: READY, AWAITING_REVEAL and REVEALED. */
export const NO_CLOCK: Clock = { endsAt: null, remainingMs: null, durationMs: 0 };

/**
 * Full length of a timed phase (or of one investigation round).
 *
 * @param phase the phase being entered.
 * @param config host-chosen phase lengths.
 * @returns milliseconds, or 0 for a phase without a clock.
 */
export function phaseDurationMs(phase: Phase, config: MurderConfig): number {
  switch (phase) {
    case "INTRO":
      return INTRO_MS;
    case "BRIEFING":
      return config.briefingSeconds * MS_PER_SECOND;
    case "SHARING":
      return config.sharingSeconds * MS_PER_SECOND;
    case "INVESTIGATION":
      return config.investigationSeconds * MS_PER_SECOND;
    case "CONCLUSION":
      return config.conclusionSeconds * MS_PER_SECOND;
    default:
      return 0;
  }
}

/** Where `advancePhase` goes from the current position, or null when only the host may move on. */
function nextPosition(shared: MurderShared): { phase: Phase; round: number } | null {
  const round = shared.investigationRound;
  switch (shared.phase) {
    case "READY":
      return { phase: "INTRO", round: 0 };
    case "INTRO":
      return { phase: "BRIEFING", round: 0 };
    case "BRIEFING":
      return { phase: "SHARING", round: 0 };
    case "SHARING":
      return { phase: "INVESTIGATION", round: 1 };
    case "INVESTIGATION":
      return round < INVESTIGATION_ROUNDS
        ? { phase: "INVESTIGATION", round: round + 1 }
        : { phase: "CONCLUSION", round };
    case "CONCLUSION":
      return { phase: "AWAITING_REVEAL", round };
    default:
      return null;
  }
}

/**
 * Moves the case to its next phase or investigation round.
 *
 * Every move increments `phaseVersion` and starts a fresh, full duration at `now`, so a late
 * callback never replays historical phases. If the class clock is paused, the next timed phase
 * starts paused with its full duration. Entering AWAITING_REVEAL clears pause and the clock.
 * Used by the deadline callback and by the host's Next/Skip intro.
 *
 * @param shared the current state; not mutated.
 * @param config host-chosen phase lengths.
 * @param now server time in epoch ms.
 * @returns the next state, or `shared` itself when only the host can move on (AWAITING_REVEAL,
 *   REVEALED).
 */
export function advancePhase(
  shared: MurderShared,
  config: MurderConfig,
  now: number,
): MurderShared {
  const target = nextPosition(shared);
  if (!target) return shared;
  const moved = {
    ...shared,
    phase: target.phase,
    investigationRound: target.round,
    phaseVersion: shared.phaseVersion + 1,
  };
  if (target.phase === "AWAITING_REVEAL") return { ...moved, paused: false, clock: NO_CLOCK };
  const durationMs = phaseDurationMs(target.phase, config);
  return shared.paused
    ? { ...moved, paused: true, clock: { endsAt: null, remainingMs: durationMs, durationMs } }
    : {
        ...moved,
        paused: false,
        clock: { endsAt: now + durationMs, remainingMs: null, durationMs },
      };
}

/**
 * The deadline the server must wake the module for, if a clock is running.
 *
 * The key encodes the case instance, case number, phase version, phase and round, so a callback from an earlier phase,
 * round or case can never be mistaken for the current one.
 *
 * @param shared the current state.
 * @returns zero entries (no clock, or paused) or one.
 */
export function deadlines(shared: MurderShared): SharedDeadline[] {
  if (shared.clock.endsAt === null) return [];
  return [
    {
      key: `mm:${shared.caseInstanceId}:${shared.caseNumber}:${shared.phaseVersion}:${shared.phase}:${shared.investigationRound}`,
      endsAt: shared.clock.endsAt,
    },
  ];
}

/**
 * Handles a due deadline.
 *
 * @param shared the current state.
 * @param expected the deadline that fired.
 * @param config host-chosen phase lengths.
 * @param now server time in epoch ms.
 * @returns the next phase, or null when the deadline is stale (different case, phase, round or
 *   time), not yet due, or no clock runs. A null result must leave the replacement state alone.
 */
export function expireDeadline(
  shared: MurderShared,
  expected: SharedDeadline,
  config: MurderConfig,
  now: number,
): MurderShared | null {
  const current = deadlines(shared)[0];
  if (!current || current.key !== expected.key || current.endsAt !== expected.endsAt) return null;
  if (now < current.endsAt) return null;
  return advancePhase(shared, config, now);
}

/**
 * Converts the class clock to the shared timer shape used by the common Timer component.
 *
 * @param clock the class clock.
 * @returns running: `endsAt` set; paused: `pausedRemainingMs` set; `durationMs` for rings.
 */
export function toTimerState(clock: Clock): TimerState {
  return {
    endsAt: clock.endsAt,
    pausedRemainingMs: clock.remainingMs,
    durationMs: clock.durationMs,
  };
}
