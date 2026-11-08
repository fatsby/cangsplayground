import { useEffect, useState, type CSSProperties } from "react";
import type { Role } from "../types.js";
import type { ScreenProps } from "./ScreenProps.js";
import { Frame, Mini, ROLE_COLOR, RoleIcon, fmt, secondsLeft, useNow } from "./shared.jsx";
import { useSfx } from "./sfx-context.js";

const POWER: Record<Role, string> = {
  werewolf: "Werewolf: vote with your pack on who to attack. Ties are random.",
  seer: "Seer: pick one player to inspect. You only learn werewolf or not.",
  guard: "Guard: protect one player. You may protect yourself once per game.",
  villager: "No power tonight. Taps are decoys: they change nothing.",
};
const IDLE: Record<Role, string> = {
  werewolf: "Pack is choosing…",
  seer: "Choose who to inspect",
  guard: "Choose who to protect",
  villager: "Sleeping…",
};
const ACTION: Partial<Record<Role, string>> = {
  werewolf: "ww:wolfVote",
  seer: "ww:seerPick",
  guard: "ww:guardPick",
};

/**
 * The night screen. Werewolf, Seer, Guard and Villager all get this same shell (same background,
 * same list, same status panel) so nobody can tell roles apart from the next seat. The Villager's
 * taps are decoys that never reach the server.
 */
export function NightScreen({
  meId: myId,
  view,
  mine,
  roster,
  act,
  serverNow,
  config,
}: ScreenProps) {
  const role = mine.role!;
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const sfx = useSfx();
  const [picked, setPicked] = useState<string | null>(mine.myNightPick);
  useEffect(() => setPicked(mine.myNightPick), [mine.myNightPick]);
  useEffect(() => {
    if (left > 0 && left <= 5) sfx.play("beat");
  }, [left]);
  const result = mine.seerLog?.find((e) => e.night === view.night);
  const living = view.players.filter((p) => p.alive && !p.pending);
  const rows = [myId, ...living.map((p) => p.id).filter((id) => id !== myId)].filter(Boolean);
  const packVotes = Object.entries(mine.wolfVotes ?? {}).filter(([voter]) => voter !== myId);

  const disabled = (id: string): boolean => {
    if (id === myId) return !(role === "guard" && !mine.guardSelfUsed);
    if (role === "werewolf") return mine.teammates.includes(id);
    if (role === "seer") return !!result && id !== result.targetId;
    return false;
  };
  const choose = (id: string) => {
    if (disabled(id)) return;
    sfx.play("drop");
    setPicked(id);
    const type = ACTION[role];
    if (type) void act({ type, payload: { targetId: id } });
  };
  const status = (): string => {
    const name = picked ? roster.name(picked) : "";
    switch (role) {
      case "werewolf":
        return picked ? `You chose ${name}` : IDLE.werewolf;
      case "guard":
        return picked
          ? picked === myId
            ? "Protecting yourself"
            : `Protecting ${name}`
          : IDLE.guard;
      case "villager":
        return picked ? `Dreaming of ${name}` : IDLE.villager;
      default:
        return IDLE.seer;
    }
  };
  const ratio = Math.min(1, left / config.nightSeconds);
  return (
    <Frame cls={`nshell ${left > 0 && left <= 5 ? "final5" : ""}`} starry>
      <div className="pbar">
        <span className="me">{roster.name(myId)}</span>
        <span className="moonmini">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="trk" cx="50" cy="50" r="46" />
            <circle
              className="prg"
              cx="50"
              cy="50"
              r="46"
              pathLength={100}
              style={{ strokeDasharray: `${ratio * 100} 100` }}
            />
          </svg>
          <i />
        </span>
        <span className="gclock">{fmt(left)}</span>
      </div>
      <div className="pbody">
        <div className="gtitle">
          <span className="h">Night {view.night}</span>
          <span className="s">Choose before dawn</span>
        </div>
        <div className="nlist">
          {rows.map((id) => {
            const tags = [];
            if (id === myId && role === "guard" && !mine.guardSelfUsed)
              tags.push(
                <span className="tag" key="left">
                  1 left
                </span>,
              );
            if (role === "werewolf" && mine.teammates.includes(id))
              tags.push(
                <span className="tag pack" key="mate">
                  Packmate
                </span>,
              );
            if (role === "werewolf")
              for (const [voter, target] of packVotes)
                if (target === id)
                  tags.push(
                    <span className="tag pack" key={voter}>
                      {roster.name(voter)} chose
                    </span>,
                  );
            if (role === "werewolf" && picked === id)
              tags.push(
                <span className="tag pack" key="you">
                  You
                </span>,
              );
            const dis = disabled(id);
            return (
              <div
                key={id}
                data-n={id}
                className={`nopt ${dis ? "dis" : ""} ${picked === id ? "sel" : ""}`}
                onClick={() => choose(id)}
              >
                <Mini roster={roster} id={id} />
                <span>{id === myId ? "You" : roster.name(id)}</span>
                {tags}
              </div>
            );
          })}
        </div>
        <div className="resbox">
          <div className="res" data-res>
            {role === "seer" && result ? (
              <>
                <b>{result.isWerewolf ? "Werewolf" : "Not a werewolf"}</b>
                <small>{roster.name(result.targetId)} · locked for tonight</small>
              </>
            ) : (
              status()
            )}
          </div>
        </div>
        <div className="power" style={{ "--c": ROLE_COLOR[role] } as CSSProperties}>
          <span className="icw">
            <RoleIcon role={role} />
          </span>
          <span>{POWER[role]}</span>
        </div>
      </div>
    </Frame>
  );
}
