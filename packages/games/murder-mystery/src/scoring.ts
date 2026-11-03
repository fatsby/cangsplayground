import type { CompiledCase, Field } from "./model.js";
import { FIELDS, proofSets } from "./solver.js";
import type { Conclusion, ScoreBreakdown } from "./types.js";

/** Points for naming each answer field correctly; evidence adds one more per field. */
export const FIELD_POINTS: Record<Field, number> = { suspectId: 3, weaponId: 2, roomId: 2 };
const EVIDENCE_POINT = 1;

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);

/**
 * Scores one team's submitted accusation. Correctness is computed only from the true answer and
 * the evidence sets the case accepts, never stored on the submission.
 *
 * Each field earns its points when named correctly. It earns one more evidence point when the
 * field is correct and the chosen cards (one or two distinct cards, all discovered by the team)
 * are exactly one of the case's valid proof sets for that field. A wrong field also scores 0 for
 * its evidence. No submission scores 0. There are no speed or grammar points; maximum 10.
 *
 * @param caseData the compiled case with the true answer.
 * @param discoveredCardIds every card the team holds (starting cards and results).
 * @param submission the frozen accusation, or null when the team never confirmed one.
 * @returns the breakdown per field and the total.
 */
export function scoreConclusion(
  caseData: CompiledCase,
  discoveredCardIds: readonly string[],
  submission: Conclusion | null,
): ScoreBreakdown {
  const evidence: Record<Field, number> = { suspectId: 0, weaponId: 0, roomId: 0 };
  const earned: Record<Field, number> = { suspectId: 0, weaponId: 0, roomId: 0 };
  if (submission) {
    const known = [...new Set(discoveredCardIds)];
    for (const field of FIELDS) {
      if (submission[field] !== caseData.reveal.answer[field]) continue;
      earned[field] = FIELD_POINTS[field];
      const chosen = submission.evidence[field];
      const wellFormed =
        chosen.length >= 1 &&
        chosen.length <= 2 &&
        new Set(chosen).size === chosen.length &&
        chosen.every((id) => known.includes(id));
      if (
        wellFormed &&
        proofSets(caseData.logic, known, field).some((set) => sameSet(set, chosen))
      ) {
        evidence[field] = EVIDENCE_POINT;
      }
    }
  }
  const total =
    earned.suspectId +
    earned.weaponId +
    earned.roomId +
    evidence.suspectId +
    evidence.weaponId +
    evidence.roomId;
  return {
    suspect: earned.suspectId,
    weapon: earned.weaponId,
    room: earned.roomId,
    evidence,
    total,
  };
}

/**
 * Competition ranking: equal totals share a rank and the following ranks are skipped
 * (10, 7, 7, 0 become 1, 2, 2, 4).
 *
 * @param totals one total per team.
 * @returns the rank of each team, in the same order.
 */
export function rankTotals(totals: readonly number[]): number[] {
  return totals.map((total) => 1 + totals.filter((other) => other > total).length);
}
