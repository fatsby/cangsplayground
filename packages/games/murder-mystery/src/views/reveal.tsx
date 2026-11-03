import { useState } from "react";
import type { MurderView } from "../types.js";
import { nameOf } from "./shared.js";
import { Stage } from "./stage.js";
import {
  REVEAL_BOARD_START_MS,
  REVEAL_TOTAL_MS,
  countUpValue,
  elapsedStyle,
  useElapsedMs,
  usePrefersReducedMotion,
} from "./timeline.js";

type Tab = "result" | "solution" | "board";

const SCORE_LINE_STEP_S = 0.5;
const TOTAL_START_MS = 3_000;
const TOTAL_COUNT_MS = 1_200;
const EVENT_STEP_S = 3.2;
const BOARD_STEP_S = 1.4;
const BOARD_COUNT_MS = 1_000;

/** "2=" for a shared rank, otherwise the plain number. */
export function rankLabel(rank: number, all: { rank: number }[]): string {
  return all.filter((r) => r.rank === rank).length > 1 ? `${rank}=` : String(rank);
}

type Timeline = { elapsed: number | null; reduced: boolean };

/**
 * The solution story: events one by one, then the culprit, weapon and room flip over and the
 * misleading statements are struck through. Used on the projector and on phones.
 */
export function SolutionStory({ view, elapsed, reduced }: { view: MurderView } & Timeline) {
  const reveal = view.reveal;
  if (!reveal) return null;
  const answersAt = 1 + reveal.events.length * EVENT_STEP_S;
  return (
    <section className="cp-panel mm-solution" aria-label="The solution">
      <ol className="mm-events">
        {reveal.events.map((event, i) => (
          <Stage key={event} d={1 + i * EVENT_STEP_S} elapsed={elapsed} reduced={reduced}>
            {event}
          </Stage>
        ))}
      </ol>
      <dl className="mm-answers">
        {(
          [
            ["Culprit", reveal.answer.suspectId],
            ["Weapon", reveal.answer.weaponId],
            ["Room", reveal.answer.roomId],
          ] as const
        ).map(([label, id], i) => (
          <div key={label}>
            <dt>{label}</dt>
            <Stage
              as="dd"
              d={answersAt + i * 0.6}
              elapsed={elapsed}
              reduced={reduced}
              className="mm-flip"
            >
              {nameOf(view, id)}
            </Stage>
          </div>
        ))}
      </dl>
      <Stage as="p" d={answersAt + 2} elapsed={elapsed} reduced={reduced} className="mm-stamp">
        Case solved
      </Stage>
      {reveal.testimonyExplanations.length > 0 && (
        <ul className="mm-struck">
          {reveal.testimonyExplanations.map((e) => (
            <Stage key={e.cardId} d={answersAt + 2.5} elapsed={elapsed} reduced={reduced}>
              {e.explanation}
            </Stage>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The scoreboard: last place appears first, tied teams together, totals counting up. */
export function Scoreboard({
  view,
  elapsed,
  reduced,
  teamName = (groupId) => groupId,
}: { view: MurderView; teamName?: (groupId: string) => string } & Timeline) {
  const results = view.results ?? [];
  const ordered = [...results].sort(
    (a, b) => b.rank - a.rank || a.groupId.localeCompare(b.groupId),
  );
  // Tied teams appear together: stage by distinct rank, last place first.
  const place = (rank: number) => [...new Set(ordered.map((r) => r.rank))].indexOf(rank);
  const at = elapsed ?? 0;
  return (
    <section className="cp-panel mm-board" aria-label="Scoreboard">
      <ol className="mm-rows">
        {ordered.map((row) => {
          const startS = REVEAL_BOARD_START_MS / 1000 + place(row.rank) * BOARD_STEP_S;
          return (
            <Stage
              key={row.groupId}
              d={startS}
              elapsed={elapsed}
              reduced={reduced}
              className={row.rank === 1 ? "mm-row mm-first" : "mm-row"}
            >
              <span className="mm-rank">{rankLabel(row.rank, results)}</span>
              <span className="mm-team">{teamName(row.groupId)}</span>
              <strong>
                {reduced
                  ? row.score.total
                  : countUpValue(row.score.total, at, startS * 1000, BOARD_COUNT_MS)}
              </strong>
            </Stage>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The phone's post-Reveal screens: Result, Solution and Scoreboard (mockup P16-P18).
 *
 * Staging is a pure function of the server time since `revealStartedAt`, so a reload or a late
 * join resumes at the right frame and anything past the end shows the final frame without
 * replaying. Reduced motion shows the final frame at once.
 *
 * @param view the projected view; `reveal` and `results` must be non-null (REVEALED).
 * @param serverNow the server clock.
 * @param teamName optional display name for a group id.
 */
export function RevealSections({
  view,
  serverNow,
  teamName = (groupId) => groupId,
}: {
  view: MurderView;
  serverNow: () => number;
  teamName?: (groupId: string) => string;
}) {
  const reduced = usePrefersReducedMotion();
  const elapsed = useElapsedMs({
    totalMs: REVEAL_TOTAL_MS,
    startedAt: view.revealStartedAt,
    serverNow,
  });
  const results = view.results ?? [];
  const mine = results.find((r) => r.groupId === view.ownTeam?.groupId);
  const [tab, setTab] = useState<Tab>(mine ? "result" : "solution");
  if (!view.reveal) return null;
  const at = elapsed ?? 0;
  const tabs: { value: Tab; label: string }[] = [
    ...(mine ? [{ value: "result" as const, label: "Result" }] : []),
    { value: "solution", label: "Solution" },
    { value: "board", label: "Scoreboard" },
  ];

  return (
    <div className="cp-stack mm-reveal" style={elapsedStyle(elapsed, reduced)}>
      <div role="tablist" className="cp-tabs mm-tabs" aria-label="Results">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            className="cp-tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "result" && mine && (
        <section className="cp-panel mm-result" aria-label="Your result">
          <ul className="mm-score-lines">
            {(
              [
                ["Right culprit", mine.score.suspect],
                ["Right weapon", mine.score.weapon],
                ["Right room", mine.score.room],
                ["Proof for the culprit", mine.score.evidence.suspectId],
                ["Proof for the weapon", mine.score.evidence.weaponId],
                ["Proof for the room", mine.score.evidence.roomId],
              ] as const
            ).map(([label, points], i) => (
              <Stage
                key={label}
                d={i * SCORE_LINE_STEP_S}
                elapsed={elapsed}
                reduced={reduced}
                className="mm-score-line"
              >
                <span>{label}</span>
                <strong>{points > 0 ? `+${points}` : "0"}</strong>
              </Stage>
            ))}
          </ul>
          <p className="mm-total" aria-label={`Total ${mine.score.total} points`}>
            Total{" "}
            <strong data-total>
              {reduced
                ? mine.score.total
                : countUpValue(mine.score.total, at, TOTAL_START_MS, TOTAL_COUNT_MS)}
            </strong>{" "}
            / 10
          </p>
          <p>Rank {rankLabel(mine.rank, results)}</p>
        </section>
      )}
      {tab === "solution" && <SolutionStory view={view} elapsed={elapsed} reduced={reduced} />}
      {tab === "board" && (
        <Scoreboard view={view} elapsed={elapsed} reduced={reduced} teamName={teamName} />
      )}
    </div>
  );
}
