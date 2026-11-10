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
  const hostVotes = view.hostVotes ?? {};
  const votersByTarget: Record<string, string[]> = {};
  for (const [voterId, targetId] of Object.entries(hostVotes)) {
    (votersByTarget[targetId] ??= []).push(voterId);
  }
  const living = inPlay.filter((p) => p.alive);
  const unvoted = living.filter((p) => !hostVotes[p.id]);
  const nightActors = living.filter((p) =>
    (["werewolf", "seer", "guard"] as Role[]).includes(roles[p.id] ?? "villager"),
  );

  const wolfTargets: Record<string, string[]> = {};
  if (night && view.hostNight) {
    for (const [wolfId, targetId] of Object.entries(view.hostNight.wolfVotes)) {
      (wolfTargets[targetId] ??= []).push(wolfId);
    }
  }
  const wolfTargetEntries = Object.entries(wolfTargets);
  const livingWolves = holders("werewolf");

  const renderChip = (id: string, ghost = false) => {
    const role = roles[id] ?? "villager";
    return (
      <span
        className={`pchip ${ghost ? "ghost-chip" : ""}`}
        key={id}
        style={{ "--rc": ROLE_COLOR[role] } as CSSProperties}
      >
        <Mini roster={roster} id={id} />
        <span>{nameOf(id)}</span>
        <i className="role-dot" />
      </span>
    );
  };

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
            const hasActed = acted.has(p.id);
            return (
              <div
                className={`hp ${p.alive ? "" : "dead"} ${hasActed ? "has-acted" : ""}`}
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
                {hasActed && <span className="acted">✓ acted</span>}
              </div>
            );
          })}
        </div>
        {night && view.hostNight && (
          <div className="panel2">
            <div className="panel2-head">
              <h4>Tonight, live</h4>
              <span className="panel2-sub">
                {acted.size}/{nightActors.length} acted
              </span>
            </div>
            <div className="ncompact-list">
              {wolfTargetEntries.length === 0 ? (
                <div
                  className="ncompact-row"
                  style={{ "--rc": ROLE_COLOR.werewolf } as CSSProperties}
                >
                  <div className="ncompact-role">
                    <span className="icw">
                      <RoleIcon role="werewolf" />
                    </span>
                    <span>Wolves</span>
                  </div>
                  <div className="group-voters">
                    {livingWolves.map((id) => renderChip(id, true))}
                  </div>
                  <span className="ncompact-empty">No votes yet</span>
                </div>
              ) : (
                wolfTargetEntries.map(([targetId, wolfIds]) => (
                  <div
                    className="ncompact-row"
                    key={`wolf-${targetId}`}
                    style={{ "--rc": ROLE_COLOR.werewolf } as CSSProperties}
                  >
                    <div className="ncompact-role">
                      <span className="icw">
                        <RoleIcon role="werewolf" />
                      </span>
                      <span>Wolves</span>
                    </div>
                    <div className="group-voters">{wolfIds.map((id) => renderChip(id))}</div>
                    <div className="ncompact-target">
                      <span className="verb-tag">Attack</span>
                      <Mini roster={roster} id={targetId} />
                      <span>{nameOf(targetId)}</span>
                    </div>
                  </div>
                ))
              )}
              {(["seer", "guard"] as const).map((role) => {
                const picks =
                  role === "seer" ? view.hostNight!.seerPicks : view.hostNight!.guardPicks;
                const people = holders(role);
                const label = role === "seer" ? "Seer" : "Guard";
                const verb = role === "seer" ? "Inspect" : "Protect";
                if (people.length === 0) {
                  return (
                    <div
                      className="ncompact-row"
                      key={role}
                      style={{ "--rc": ROLE_COLOR[role] } as CSSProperties}
                    >
                      <div className="ncompact-role">
                        <span className="icw">
                          <RoleIcon role={role} />
                        </span>
                        <span>{label}</span>
                      </div>
                      <div className="group-voters" />
                      <span className="ncompact-empty">No one</span>
                    </div>
                  );
                }
                return people.map((id) => {
                  const targetId = picks[id];
                  return (
                    <div
                      className="ncompact-row"
                      key={`${role}-${id}`}
                      style={{ "--rc": ROLE_COLOR[role] } as CSSProperties}
                    >
                      <div className="ncompact-role">
                        <span className="icw">
                          <RoleIcon role={role} />
                        </span>
                        <span>{label}</span>
                      </div>
                      <div className="group-voters">{renderChip(id, !targetId)}</div>
                      {targetId ? (
                        <div className="ncompact-target">
                          <span className="verb-tag">{verb}</span>
                          <Mini roster={roster} id={targetId} />
                          <span>{nameOf(targetId)}</span>
                        </div>
                      ) : (
                        <span className="ncompact-empty">Has not chosen</span>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}
        {view.stage === "VOTE" && (
          <>
            <div className="panel2">
              <div className="panel2-head">
                <h4>Votes · needs {needed}</h4>
                <span className="panel2-sub">
                  {Object.keys(hostVotes).length}/{living.length} voted
                </span>
              </div>
              {totals.length === 0 ? (
                <div className="line">No votes yet.</div>
              ) : (
                <div className="vtarget-list">
                  {totals.map(([id, count]) => {
                    const voters = votersByTarget[id] ?? [];
                    return (
                      <div
                        className={`vtarget-card vbar ${count >= needed ? "reach" : ""}`}
                        key={id}
                      >
                        <div className="vtarget-top">
                          <Mini roster={roster} id={id} />
                          <span className="vtarget-name">{nameOf(id)}</span>
                          <div className="vtarget-bar tr">
                            <i style={{ width: `${Math.min(100, (count / needed) * 100)}%` }} />
                          </div>
                          <span className="vtarget-cnt">
                            {count}/{needed}
                          </span>
                        </div>
                        {voters.length > 0 && (
                          <div className="voter-row">
                            <span className="voter-lbl">Voted by</span>
                            {voters.map((voterId) => renderChip(voterId))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {unvoted.length > 0 && (
                    <div className="unvoted-bar">
                      <span className="voter-lbl">Waiting</span>
                      {unvoted.map((p) => renderChip(p.id, true))}
                    </div>
                  )}
                </div>
              )}
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
