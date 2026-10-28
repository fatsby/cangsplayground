import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { teamName, teamStyle } from "@cangsplayground/core";
import { Button, PlayerIdentity, TeamBadge, type SessionViewProps } from "@cangsplayground/ui";
import type { Score } from "../rules.js";
import type { SharkTankView } from "../types.js";

type Props = Pick<SessionViewProps, "lobby"> & { shared: SharkTankView };
type Phase =
  "opening" | "team" | "revenue" | "sale" | "wallet" | "penalties" | "total" | "finale" | "podium";
type Cue = { phase: Phase; team: number; sale: number; at: number };
const money = (value: number) =>
  `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString("en-US")}`;

/** Each digit makes two full turns, then decelerates into its final position. */
function RollingMoney({ value, animate = true }: { value: number; animate?: boolean }) {
  const formatted = money(value);
  return (
    <span className={`st-odometer ${animate ? "st-odometer-roll" : ""}`} key={value}>
      <span className="st-visually-hidden">{formatted}</span>
      <span className="st-odometer-face" aria-hidden="true">
        {[...formatted].map((char, index) =>
          /\d/.test(char) ? (
            <span className="st-digit" key={index}>
              <span
                className="st-digit-reel"
                style={
                  {
                    "--digit-end": Number(char) + 20,
                    "--digit-delay": `${index * 45}ms`,
                  } as CSSProperties
                }
              >
                {Array.from({ length: 30 }, (_, n) => (
                  <span key={n} data-glyph={n % 10} />
                ))}
              </span>
            </span>
          ) : (
            <span key={index} data-glyph={char} />
          ),
        )}
      </span>
    </span>
  );
}

function salesFor(shared: SharkTankView, id: string) {
  return shared.companies
    .flatMap((company) => company.purchases ?? [])
    .filter((purchase) => purchase.seller === id && purchase.quantity > 0);
}

function sequence(shared: SharkTankView): Cue[] {
  const cues: Cue[] = [];
  let at = 0;
  const add = (phase: Phase, duration: number, team = -1, sale = -1) => {
    cues.push({ phase, team, sale, at });
    at += duration;
  };
  add("opening", 1800);
  shared.results?.scores.forEach((score, team) => {
    add("team", 1800, team);
    add("revenue", 1200, team);
    salesFor(shared, score.groupId).forEach((_, sale) => add("sale", 1200, team, sale));
    add("wallet", 1800, team);
    add("penalties", 1800, team);
    add("total", 2800, team);
  });
  add("finale", 1800);
  add("podium", 0);
  return cues;
}

function TeamMembers({ lobby, shared, id }: Props & { id: string }) {
  const company = shared.companies.find((c) => c.groupId === id);
  return (
    <ul className="st-reveal-members" aria-label="Team members">
      {company?.members.map((member) => (
        <li className="cp-person" key={member}>
          <PlayerIdentity
            player={lobby.players.find((p) => p.id === member)}
            playerId={member}
            size={28}
          />
        </li>
      ))}
    </ul>
  );
}

function ScoreCard({
  lobby,
  shared,
  score,
  cue,
  reduced = false,
}: Props & {
  score: Score;
  cue?: Cue;
  reduced?: boolean;
}) {
  const company = shared.companies.find((c) => c.groupId === score.groupId);
  const group = lobby.groups.find((g) => g.id === score.groupId);
  const index = group?.index ?? 0;
  const sales = salesFor(shared, score.groupId);
  const phase = cue?.phase ?? "total";
  const earning = phase !== "team";
  const wallet = ["wallet", "penalties", "total"].includes(phase);
  const penalties = ["penalties", "total"].includes(phase);
  const total = phase === "total";
  const shownSales =
    phase === "team" || phase === "revenue"
      ? []
      : phase === "sale"
        ? sales.slice(0, cue!.sale + 1)
        : sales;
  const revenue =
    phase === "sale" || phase === "revenue"
      ? shownSales.reduce((sum, sale) => sum + sale.quantity * sale.price, 0)
      : score.revenue;
  const quantities = shownSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const salesList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!cue || !salesList.current) return;
    salesList.current.scrollTop = salesList.current.scrollHeight;
  }, [cue, shownSales.length]);
  return (
    <article
      className={`st-result st-reveal-card ${cue ? "st-spotlight" : "st-static-score"}`}
      data-group-id={score.groupId}
      data-phase={phase}
      style={{ "--reveal-team": teamStyle(index).neon } as CSSProperties}
    >
      <div className="st-reveal-identity">
        <TeamBadge teamIndex={index} />
        <h2 className="st-reveal-team-name">{group?.name ?? teamName(index)}</h2>
        <p className="st-reveal-product">
          {company?.idea?.emoji} {company?.idea?.name}
        </p>
        <TeamMembers lobby={lobby} shared={shared} id={score.groupId} />
      </div>
      <div className="st-reveal-finances">
        <div className={`st-revenue-block ${earning ? "is-revealed" : ""}`}>
          {earning && (
            <>
              <div className="st-revenue-heading">
                <span>Money earned</span>
                <span>
                  {quantities} {quantities === 1 ? "item" : "items"} sold
                </span>
              </div>
              <strong className="st-revenue-number">
                <RollingMoney value={revenue} animate={!reduced} />
              </strong>
              <ul className="st-sales" aria-label="Sales by buyer" ref={salesList}>
                {shownSales.map((sale, i) => (
                  <li className="st-sale" key={`${sale.buyer}-${i}`}>
                    <TeamBadge
                      teamIndex={lobby.groups.find((g) => g.id === sale.buyer)?.index ?? 0}
                    />
                    <span>
                      {sale.quantity} × {money(sale.price)}
                    </span>
                    <strong>
                      <RollingMoney value={sale.quantity * sale.price} animate={!reduced} />
                    </strong>
                  </li>
                ))}
                {!sales.length && <li className="st-no-sales">No sales this round</li>}
              </ul>
            </>
          )}
        </div>
        <dl className="st-score st-reveal-score">
          <div className={wallet ? "is-revealed" : "st-unrevealed"}>
            {wallet && (
              <>
                <dt>
                  Money not spent <small>Wallet remaining · not a deduction</small>
                </dt>
                <dd>
                  <RollingMoney value={company?.wallet ?? 0} animate={!reduced} />
                </dd>
              </>
            )}
          </div>
          <div className={penalties ? "is-revealed st-deduction" : "st-unrevealed"}>
            {penalties && (
              <>
                <dt>
                  Unspent penalty <small>Below the minimum spend</small>
                </dt>
                <dd>
                  <RollingMoney value={-score.shortfall} animate={!reduced} />
                </dd>
              </>
            )}
          </div>
          <div className={penalties ? "is-revealed st-deduction" : "st-unrevealed"}>
            {penalties && (
              <>
                <dt>No-question penalty</dt>
                <dd>
                  <RollingMoney value={-score.noQuestion} animate={!reduced} />
                </dd>
              </>
            )}
          </div>
          <div className={total ? "is-revealed st-total-impact" : "st-unrevealed"}>
            {total && (
              <>
                <dt>
                  Final total <small>Earned − penalties</small>
                </dt>
                <dd>
                  <RollingMoney value={score.total} animate={!reduced} />
                </dd>
              </>
            )}
          </div>
        </dl>
      </div>
    </article>
  );
}

function Crown() {
  return (
    <svg className="st-crown" viewBox="0 0 80 64" role="img" aria-label="Winner crown">
      <path
        d="M10 18 26 32 40 8 54 32 70 18 63 52H17Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <path d="M21 59h38" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="40" cy="8" r="5" fill="currentColor" />
    </svg>
  );
}

function Podium({ lobby, shared, reduced }: Props & { reduced: boolean }) {
  const scores = [...(shared.results?.scores ?? [])].reverse();
  const ranked = scores.map((score) => ({
    score,
    rank: 1 + scores.filter((other) => other.total > score.total).length,
  }));
  const podium = ranked.filter(({ rank }) => rank <= 3);
  const remaining = ranked.filter(({ rank }) => rank > 3);
  // Classic 2–1–3 podium for distinct ranks; ties stay on the same step.
  const ranks = [2, 1, 3].filter((rank) => podium.some((team) => team.rank === rank));
  const badge = (id: string) => (
    <TeamBadge key={id} teamIndex={lobby.groups.find((g) => g.id === id)?.index ?? 0} />
  );
  const award = (ids: string[]) =>
    ids.length > 3 ? <span className="st-award-tie">{ids.length} teams tie</span> : ids.map(badge);
  return (
    <div className="st-finale">
      <div className="st-podium" aria-label="Final podium">
        <div className="st-godrays" aria-hidden="true" />
        <div className="st-podium-heading">
          <span className="st-reveal-eyebrow">The deals are done. The scores are in.</span>
          <h2>Meet your top startups.</h2>
        </div>
        <div
          className="st-podium-steps"
          style={{ "--podium-columns": ranks.length } as CSSProperties}
        >
          {ranks.map((rank) => (
            <div className={`st-podium-step st-podium-rank-${rank}`} key={rank}>
              {podium
                .filter((team) => team.rank === rank)
                .map(({ score }) => {
                  const group = lobby.groups.find((g) => g.id === score.groupId);
                  const winner = shared.results?.bestStartup.includes(score.groupId);
                  return (
                    <div
                      className={`st-podium-team ${winner ? "st-winner" : ""}`}
                      data-rank={rank}
                      key={score.groupId}
                      style={
                        { "--reveal-team": teamStyle(group?.index ?? 0).neon } as CSSProperties
                      }
                    >
                      {winner && <Crown />}
                      {badge(score.groupId)}
                      <h3>{group?.name ?? teamName(group?.index ?? 0)}</h3>
                      <p className="st-podium-founders">
                        {shared.companies.find((company) => company.groupId === score.groupId)
                          ?.members.length ?? 0}{" "}
                        members
                      </p>
                      <strong className="st-podium-money">
                        <RollingMoney value={score.total} animate={!reduced} />
                      </strong>
                    </div>
                  );
                })}
              <div className="st-podium-plinth">
                <span>{String(rank).padStart(2, "0")}</span>
                <small>
                  {rank === 1 ? "BEST STARTUP" : rank === 2 ? "SECOND PLACE" : "THIRD PLACE"}
                </small>
              </div>
            </div>
          ))}
        </div>
      </div>
      {remaining.length > 0 && (
        <ol className="st-other-places" aria-label="Other placements">
          {remaining.map(({ score, rank }) => (
            <li key={score.groupId}>
              <span>#{rank}</span>
              {badge(score.groupId)}
              <strong>{money(score.total)}</strong>
            </li>
          ))}
        </ol>
      )}
      <div className="st-awards">
        <div className="cp-row">
          <h2>Best Startup</h2>
          {award(shared.results?.bestStartup ?? [])}
        </div>
        {!!shared.results?.bestShark.length && (
          <div className="cp-row">
            <h2>Best Buyer</h2>
            {award(shared.results.bestShark)}
          </div>
        )}
      </div>
      <details className="st-breakdown" open={reduced || undefined}>
        <summary>Full score breakdown</summary>
        <div className="st-breakdown-grid">
          {shared.results?.scores.map((score) => (
            <ScoreCard lobby={lobby} shared={shared} score={score} key={score.groupId} reduced />
          ))}
        </div>
      </details>
    </div>
  );
}

const narration: Record<Phase, string> = {
  opening: "Every pitch. Every deal. One final reveal.",
  team: "Meet the team.",
  revenue: "Let's count the sales.",
  sale: "Another deal lands.",
  wallet: "What's left in the wallet?",
  penalties: "Now, the deductions.",
  total: "The final total.",
  finale: "The stage is yours.",
  podium: "Celebrate your startups. Get ready for the I bought… round.",
};

export function Results({ lobby, shared }: Props) {
  const reduced = Boolean(useReducedMotion());
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const celebrated = useRef(false);
  const schedule = sequence(shared);
  // Equal server snapshots must not restart an in-progress ceremony.
  const scheduleKey = JSON.stringify(schedule);
  useEffect(() => {
    if (reduced || skipped) return;
    const cues = JSON.parse(scheduleKey) as Cue[];
    const timers = cues.slice(1).map((cue, index) => setTimeout(() => setStep(index + 1), cue.at));
    return () => timers.forEach(clearTimeout);
  }, [scheduleKey, reduced, run, skipped]);
  const cue = reduced || skipped ? schedule.at(-1)! : (schedule[step] ?? schedule.at(-1)!);
  const complete = cue.phase === "podium";
  useEffect(() => {
    if (!complete || reduced || celebrated.current || !shared.results?.scores.length) return;
    celebrated.current = true;
    void confetti({
      particleCount: 140,
      spread: 100,
      origin: { y: 0.58 },
      colors: ["#FFE14D", ...lobby.groups.map((group) => teamStyle(group.index).neon)],
      disableForReducedMotion: true,
    });
  }, [complete, reduced, shared.results, lobby.groups]);
  const scores = shared.results?.scores ?? [];
  const score = scores[cue.team];
  const group = lobby.groups.find((g) => g.id === score?.groupId);
  const completed =
    complete || cue.phase === "finale" ? scores : scores.slice(0, Math.max(0, cue.team));
  if (!scores.length) return <p className="st-next">No results to reveal yet.</p>;
  return (
    <div
      className={`st-ceremony ${reduced ? "st-motion-reduced" : ""}`}
      key={run}
      data-phase={cue.phase}
    >
      <div className="st-ceremony-toolbar">
        <p className="st-ceremony-caption" role="status">
          {score ? `${group?.name ?? teamName(group?.index ?? 0)} · ` : ""}
          {narration[cue.phase]}
        </p>
        {complete ? (
          <Button
            variant="ghost"
            onClick={() => {
              setStep(0);
              setSkipped(false);
              setRun((n) => n + 1);
              celebrated.current = false;
            }}
            disabled={reduced}
          >
            Replay reveal
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setSkipped(true)}>
            Skip to podium
          </Button>
        )}
      </div>
      {complete ? (
        <Podium lobby={lobby} shared={shared} reduced={reduced} />
      ) : (
        <>
          {cue.phase === "opening" || cue.phase === "finale" ? (
            <div className="st-reveal-interlude" key={cue.phase}>
              <div className="st-reveal-orbit" aria-hidden="true" />
              <span className="st-reveal-eyebrow">
                {cue.phase === "opening"
                  ? "Shark Tank / The final reveal"
                  : "Every startup has had its moment"}
              </span>
              <h2>
                {cue.phase === "opening" ? (
                  <>
                    Big ideas.
                    <br />
                    <em>Final numbers.</em>
                  </>
                ) : (
                  <>
                    Your startups.
                    <br />
                    <em>Your champions.</em>
                  </>
                )}
              </h2>
              <p>
                {cue.phase === "opening"
                  ? "From the lowest score to the highest. Every deal counts."
                  : "Make some room at the top."}
              </p>
            </div>
          ) : (
            score && (
              <div className="st-spotlight-wrap" key={score.groupId}>
                <span className="st-reveal-eyebrow st-reveal-counter">
                  Startup {String(cue.team + 1).padStart(2, "0")}{" "}
                  <span>/ {String(scores.length).padStart(2, "0")}</span>
                </span>
                <ScoreCard lobby={lobby} shared={shared} score={score} cue={cue} />
              </div>
            )
          )}
          <div
            className="st-reveal-progress"
            aria-label={`${completed.length} of ${scores.length} teams revealed`}
          >
            {scores.map((s, i) => (
              <div
                key={s.groupId}
                className={`st-progress-team ${i < completed.length ? "is-complete" : i === cue.team ? "is-active" : ""}`}
              >
                {i < completed.length ? (
                  <>
                    <TeamBadge
                      teamIndex={lobby.groups.find((g) => g.id === s.groupId)?.index ?? 0}
                    />
                    <strong>{money(s.total)}</strong>
                  </>
                ) : (
                  <span>
                    {i === cue.team ? "On stage" : "Up next"}{" "}
                    <b>{String(i + 1).padStart(2, "0")}</b>
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
