import type { GameAction, GroupContext, SharedArgs, Viewer } from "@cangsplayground/core";
import { z } from "zod";
import { NO_CLOCK, advancePhase } from "./clock.js";
import type { MurderConfig } from "./config.js";
import { transferResponsibilities } from "./lifecycle.js";
import {
  discoveredCardIds,
  isDraftComplete,
  prepareCase,
  submitterOf,
  teamOfPlayer,
  validateTeams,
} from "./round.js";
import { availableActions } from "./solver.js";
import type { Conclusion, MurderShared, Phase, TeamState } from "./types.js";

/** Everything a reducer needs besides the state: config, roster, server time and rng. */
export type ActionContext = Omit<SharedArgs<MurderConfig, MurderShared>, "shared">;

/** Milliseconds one Extend adds to the running or paused clock. */
export const EXTEND_MS = 30_000;

const TIMED_PHASES: ReadonlySet<Phase> = new Set([
  "INTRO",
  "BRIEFING",
  "SHARING",
  "INVESTIGATION",
  "CONCLUSION",
]);
const MAX_ID_LENGTH = 64;

const int = z.number().int().min(0);
const id = z.string().min(1).max(MAX_ID_LENGTH);
const guard = { caseNumber: int, phaseVersion: int };
const cardIds = z.array(id).max(2);
const conclusionSchema = z.strictObject({
  suspectId: id.nullable(),
  weaponId: id.nullable(),
  roomId: id.nullable(),
  evidence: z.strictObject({ suspectId: cardIds, weaponId: cardIds, roomId: cardIds }),
});

const guardOnly = z.strictObject(guard);
const investigateSchema = z.strictObject({ ...guard, round: int, actionId: id });
const saveDraftSchema = z.strictObject({
  ...guard,
  draftVersion: int,
  conclusion: conclusionSchema,
});
const submitSchema = z.strictObject({ ...guard, draftVersion: int });
const transferSchema = z.strictObject({
  ...guard,
  groupId: id,
  fromPlayerId: id,
  toPlayerId: id,
});
const extendSchema = z.strictObject({ ...guard, seconds: z.literal(EXTEND_MS / 1000) });

type Who = "host" | "player";
type Command = {
  who: Who;
  schema: z.ZodType<z.infer<typeof guardOnly>>;
  run: (
    shared: MurderShared,
    ctx: ActionContext,
    actor: Viewer,
    data: never,
  ) => MurderShared | null;
};

const withTeam = (shared: MurderShared, team: TeamState): MurderShared => ({
  ...shared,
  teams: shared.teams.map((t) => (t.groupId === team.groupId ? team : t)),
});

/** A clock that is running and has not reached its deadline yet. */
const isLive = (shared: MurderShared, now: number): boolean =>
  !shared.paused && shared.clock.endsAt !== null && now < shared.clock.endsAt;

/** Cards, answers and evidence in a draft must all exist and be discovered by the team. */
function isValidConclusion(shared: MurderShared, team: TeamState, conclusion: Conclusion): boolean {
  const { domains } = shared.caseData.logic;
  if (conclusion.suspectId !== null && !domains.suspectIds.includes(conclusion.suspectId))
    return false;
  if (conclusion.weaponId !== null && !domains.weaponIds.includes(conclusion.weaponId))
    return false;
  if (conclusion.roomId !== null && !domains.roomIds.includes(conclusion.roomId)) return false;
  const known = discoveredCardIds(team);
  return Object.values(conclusion.evidence).every(
    (cards) => new Set(cards).size === cards.length && cards.every((card) => known.includes(card)),
  );
}

/** The submitter of the actor's team during the live CONCLUSION phase, or null. */
function submitterTeam(shared: MurderShared, ctx: ActionContext, actor: Viewer): TeamState | null {
  if (actor.kind !== "player" || shared.phase !== "CONCLUSION" || !isLive(shared, ctx.now))
    return null;
  const team = teamOfPlayer(shared, actor.playerId);
  if (!team || !team.active || team.submission !== null) return null;
  return submitterOf(team) === actor.playerId ? team : null;
}

const clockEdit = (
  shared: MurderShared,
  clock: MurderShared["clock"],
  paused: boolean,
): MurderShared => ({
  ...shared,
  paused,
  clock,
  phaseVersion: shared.phaseVersion + 1,
});

function newCase(shared: MurderShared, ctx: ActionContext): MurderShared | null {
  if (shared.phase !== "REVEALED") return null;
  const groups: GroupContext[] = shared.teams.map((team) => ({
    groupId: team.groupId,
    playerIds: ctx.roster.filter((entry) => entry.groupId === team.groupId).map((e) => e.playerId),
    round: shared.caseNumber + 1,
  }));
  if (validateTeams(groups) !== null) return null;
  try {
    return prepareCase(groups, shared.caseNumber + 1, ctx.rng);
  } catch {
    return null;
  }
}

const COMMANDS: Record<string, Command> = {
  "mm:start": {
    who: "host",
    schema: guardOnly,
    run: (shared, ctx) =>
      shared.phase === "READY" ? advancePhase(shared, ctx.config, ctx.now) : null,
  },
  "mm:investigate": {
    who: "player",
    schema: investigateSchema,
    run: (shared, ctx, actor, data: z.infer<typeof investigateSchema>) => {
      if (actor.kind !== "player" || shared.phase !== "INVESTIGATION" || !isLive(shared, ctx.now))
        return null;
      const team = teamOfPlayer(shared, actor.playerId);
      if (!team || !team.active || data.round !== shared.investigationRound) return null;
      if (team.leadOrder[data.round - 1] !== actor.playerId) return null;
      if (team.history.some((entry) => entry.round === data.round)) return null;
      const used = team.history.map((entry) => entry.actionId);
      const action = availableActions(shared.caseData.logic, used, discoveredCardIds(team)).find(
        (candidate) => candidate.id === data.actionId,
      );
      if (!action) return null;
      const owners = { ...team.owners };
      for (const cardId of action.resultCardIds) owners[cardId] = actor.playerId;
      return withTeam(shared, {
        ...team,
        owners,
        history: [
          ...team.history,
          { round: data.round, actionId: action.id, recipientId: actor.playerId },
        ],
      });
    },
  },
  "mm:saveDraft": {
    who: "player",
    schema: saveDraftSchema,
    run: (shared, ctx, actor, data: z.infer<typeof saveDraftSchema>) => {
      const team = submitterTeam(shared, ctx, actor);
      if (!team || data.draftVersion !== team.draftVersion) return null;
      if (!isValidConclusion(shared, team, data.conclusion)) return null;
      return withTeam(shared, {
        ...team,
        draft: data.conclusion,
        draftVersion: team.draftVersion + 1,
      });
    },
  },
  "mm:submit": {
    who: "player",
    schema: submitSchema,
    run: (shared, ctx, actor, data: z.infer<typeof submitSchema>) => {
      const team = submitterTeam(shared, ctx, actor);
      if (!team || data.draftVersion !== team.draftVersion || !isDraftComplete(team.draft))
        return null;
      return withTeam(shared, { ...team, submission: structuredClone(team.draft) });
    },
  },
  "mm:pause": {
    who: "host",
    schema: guardOnly,
    run: (shared, ctx) =>
      TIMED_PHASES.has(shared.phase) && isLive(shared, ctx.now)
        ? clockEdit(
            shared,
            { ...shared.clock, endsAt: null, remainingMs: shared.clock.endsAt! - ctx.now },
            true,
          )
        : null,
  },
  "mm:resume": {
    who: "host",
    schema: guardOnly,
    run: (shared, ctx) =>
      shared.paused && shared.clock.remainingMs !== null
        ? clockEdit(
            shared,
            { ...shared.clock, endsAt: ctx.now + shared.clock.remainingMs, remainingMs: null },
            false,
          )
        : null,
  },
  "mm:extend": {
    who: "host",
    schema: extendSchema,
    run: (shared, ctx) => {
      // INTRO has a fixed length; READY, AWAITING_REVEAL and REVEALED have no clock.
      if (!TIMED_PHASES.has(shared.phase) || shared.phase === "INTRO") return null;
      const durationMs = shared.clock.durationMs + EXTEND_MS;
      if (shared.paused && shared.clock.remainingMs !== null) {
        return clockEdit(
          shared,
          { ...shared.clock, remainingMs: shared.clock.remainingMs + EXTEND_MS, durationMs },
          true,
        );
      }
      if (!isLive(shared, ctx.now)) return null;
      return clockEdit(
        shared,
        { ...shared.clock, endsAt: shared.clock.endsAt! + EXTEND_MS, durationMs },
        false,
      );
    },
  },
  "mm:next": {
    who: "host",
    schema: guardOnly,
    run: (shared, ctx) =>
      TIMED_PHASES.has(shared.phase) ? advancePhase(shared, ctx.config, ctx.now) : null,
  },
  "mm:reveal": {
    who: "host",
    schema: guardOnly,
    run: (shared, ctx) =>
      shared.phase === "AWAITING_REVEAL"
        ? {
            ...shared,
            phase: "REVEALED",
            phaseVersion: shared.phaseVersion + 1,
            revealedAt: ctx.now,
            paused: false,
            clock: NO_CLOCK,
          }
        : null,
  },
  "mm:transfer": {
    who: "host",
    schema: transferSchema,
    run: (shared, _ctx, _actor, data: z.infer<typeof transferSchema>) =>
      transferResponsibilities(shared, data.groupId, data.fromPlayerId, data.toPlayerId),
  },
  "mm:newCase": { who: "host", schema: guardOnly, run: (shared, ctx) => newCase(shared, ctx) },
};

/**
 * Applies one player or host command to the shared state.
 *
 * Every command carries the `caseNumber` and `phaseVersion` it was issued in; a mismatch rejects
 * it, so a late or retried request can never spend the next round or submit a newer draft.
 * Payloads are strict (unknown keys are rejected). Rejections return null and leave `shared`
 * untouched; none of them reveals the answer, and accepted results carry no correctness.
 *
 * | Command | Who | Effect |
 * |---|---|---|
 * | `mm:start` | host, READY | enter INTRO (the fixed 13 s), then BRIEFING follows |
 * | `mm:investigate` | the round's lead, live INVESTIGATION | spend the team's round on one available action and give its cards to the lead |
 * | `mm:saveDraft` | the submitter, live CONCLUSION | replace the draft; bumps `draftVersion` |
 * | `mm:submit` | the submitter | freeze a complete draft once |
 * | `mm:pause` / `mm:resume` | host | freeze / restart the running clock, keeping the remainder |
 * | `mm:extend` | host, timed phase except INTRO | add exactly 30 s |
 * | `mm:next` | host, timed phase | skip to the next phase or round (Skip intro in INTRO), keeping pause |
 * | `mm:reveal` | host, AWAITING_REVEAL | open results and store the server time once |
 * | `mm:newCase` | host, REVEALED | prepare the next case for the retained teams from the live roster |
 *
 * @param shared current state; never mutated.
 * @param ctx config, roster, server time and rng.
 * @param actor who sent the command.
 * @param action command type and payload.
 * @returns the new state, or null when the command is rejected.
 */
export function reduceAction(
  shared: MurderShared,
  ctx: ActionContext,
  actor: Viewer,
  action: GameAction,
): MurderShared | null {
  const command = COMMANDS[action.type];
  if (!command || actor.kind !== command.who) return null;
  const parsed = command.schema.safeParse(action.payload);
  if (!parsed.success) return null;
  if (
    parsed.data.caseNumber !== shared.caseNumber ||
    parsed.data.phaseVersion !== shared.phaseVersion
  ) {
    return null;
  }
  return command.run(shared, ctx, actor, parsed.data as never);
}
