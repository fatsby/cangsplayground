import type { CSSProperties } from "react";
import type { GameAction } from "@cangsplayground/core";
import type { Role } from "../types.js";
import type { WerewolfView } from "../WerewolfView.js";
import { PendingJoiners } from "./PendingJoiners.js";
import type { Roster } from "./Roster.js";
import { Mini, ROLE_COLOR, ROLE_LABEL, RoleIcon, fmt, secondsLeft, useNow } from "./shared.jsx";

const PHASE: Record<string, string> = {
  REVEAL: "ROLE REVEAL",
  DAWN: "DAWN",
  VERDICT: "VERDICT",
  ENDED: "GAME OVER",
};

/**
 * The host's "god view" while a game runs: every role, who has acted tonight, the live night
 * choices, and who voted for whom. Never shown to players or the projector.
 */
export function HostGodView({
  view,
  roster,
  busy,
  serverNow,
  hostAct,
}: {
  view: WerewolfView;
  roster: Roster;
  busy: boolean;
  serverNow: () => number;
  hostAct?: (action: GameAction) => Promise<boolean>;
}) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const roles = view.roles ?? {};
  const night = view.stage === "NIGHT";
  const phase =
    PHASE[view.stage] ?? (night ? `NIGHT ${view.night}` : `DAY ${view.night} · ${view.stage}`);
  const inPlay = view.players.filter((p) => !p.pending);
  const nameOf = roster.name;
  const holders = (role: Role) =>
    view.players.filter((p) => p.alive && !p.pending && roles[p.id] === role).map((p) => p.id);
  const acted = new Set<string>();
  if (night && view.hostNight) {
    Object.keys(view.hostNight.wolfVotes).forEach((id) => acted.add(id));
    Object.keys(view.hostNight.seerPicks).forEach((id) => acted.add(id));
    Object.keys(view.hostNight.guardPicks).forEach((id) => acted.add(id));
  }
  const needed = Math.max(1, view.needed);
  const totals = Object.entries(view.voteCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="hf">
      <div className="hf-h">
        <div>
          <div className="lbl">Host · God view</div>
        </div>
        <div className="sp">
          <span className={`phase ${night ? "night" : "day"}`}>{phase}</span>
          {view.deadlineAt !== null && <span className="gclock">{fmt(left)}</span>}
        </div>
      </div>
      <div className="hf-b">
        {view.stage === "ENDED" && (
          <div className="banner ok">
            🏁 <span>{view.winner === "wolves" ? "The wolves win" : "The village wins"}</span>
          </div>
        )}
        <div className="hgrid">
          {inPlay.map((p) => {
            const role = roles[p.id] ?? "villager";
            return (
              <div
                className={`hp ${p.alive ? "" : "dead"}`}
                key={p.id}
                style={{ "--rc": ROLE_COLOR[role] } as CSSProperties}
              >
                <Mini roster={roster} id={p.id} />
                <span className="nm3">{nameOf(p.id)}</span>
                <span className="rb">
                  <span className="icw">
                    <RoleIcon role={p.alive ? role : "skull"} />
                  </span>
                  {p.alive ? ROLE_LABEL[role] : ""}
                </span>
                {acted.has(p.id) && <span className="acted">✓ acted</span>}
              </div>
            );
          })}
        </div>
        {night && view.hostNight && (
          <div className="panel2">
            <h4>Tonight, live</h4>
            <div className="line">
              <span className="icw">
                <RoleIcon role="werewolf" />
              </span>
              <b>Wolves</b>
              {Object.keys(view.hostNight.wolfVotes).length === 0
                ? "no votes yet"
                : Object.entries(view.hostNight.wolfVotes)
                    .map(([w, t]) => `${nameOf(w)} → ${nameOf(t)}`)
                    .join(" · ")}
            </div>
            {(["seer", "guard"] as const).map((role) => {
              const picks =
                role === "seer" ? view.hostNight!.seerPicks : view.hostNight!.guardPicks;
              const people = holders(role);
              return (
                <div className="line" key={role}>
                  <span className="icw">
                    <RoleIcon role={role} />
                  </span>
                  <b>{role === "seer" ? "Seer" : "Guard"}</b>
                  {people.length === 0
                    ? "no one"
                    : people
                        .map((id) =>
                          picks[id]
                            ? `${nameOf(id)} ${role === "seer" ? "inspects" : "protects"} ${nameOf(picks[id]!)}`
                            : `${nameOf(id)} has not chosen`,
                        )
                        .join(" · ")}
                </div>
              );
            })}
          </div>
        )}
        {view.stage === "VOTE" && (
          <>
            <div className="panel2">
              <h4>Votes · needs {needed}</h4>
              {totals.length === 0 && <div className="line">No votes yet.</div>}
              {totals.map(([id, count]) => (
                <div className={`vbar ${count >= needed ? "reach" : ""}`} key={id}>
                  <span>{nameOf(id)}</span>
                  <div className="tr">
                    <i style={{ width: `${Math.min(100, (count / needed) * 100)}%` }} />
                    <b style={{ left: "100%" }} />
                  </div>
                  <span>
                    {count}/{needed}
                  </span>
                </div>
              ))}
            </div>
            <div className="panel2">
              <h4>Who voted for whom (host only)</h4>
              <div className="line">
                {Object.entries(view.hostVotes ?? {}).length === 0
                  ? "No votes yet."
                  : Object.entries(view.hostVotes ?? {})
                      .map(([v, t]) => `${nameOf(v)} → ${nameOf(t)}`)
                      .join(" · ")}
              </div>
            </div>
            <span className="secret-note">🔒 Players and the projector only see the totals.</span>
          </>
        )}
        {view.stage === "DAWN" && (
          <div className="panel2">
            <h4>Last night</h4>
            <div className="line">
              {view.dawn?.eliminatedId
                ? `${nameOf(view.dawn.eliminatedId)} was killed.`
                : "No one died."}
            </div>
          </div>
        )}
        {view.stage === "VERDICT" && view.lastVote && (
          <div className="panel2">
            <h4>Verdict</h4>
            <div className="line">
              {view.lastVote.eliminatedId
                ? `${nameOf(view.lastVote.eliminatedId)} was banished.`
                : "No one was banished."}
            </div>
          </div>
        )}
        <PendingJoiners view={view} roster={roster} busy={busy} {...(hostAct ? { hostAct } : {})} />
      </div>
    </div>
  );
}
