import type { GameAction } from "@cangsplayground/core";
import type { WerewolfView } from "../WerewolfView.js";
import type { Roster } from "./Roster.js";
import { RoleSelector } from "./RoleSelector.js";
import { Mini } from "./shared.jsx";

/**
 * Players who joined after the game started. They enter at the next dawn with the role chosen here
 * (default Villager); nobody else is told the host picked it.
 */
export function PendingJoiners({
  view,
  roster,
  busy,
  hostAct,
}: {
  view: WerewolfView;
  roster: Roster;
  busy: boolean;
  hostAct?: (action: GameAction) => Promise<boolean>;
}) {
  const waiting = view.players.filter((p) => p.pending);
  return (
    <>
      {waiting.map((p) => (
        <div className="pending" key={p.id}>
          <div className="top">
            <Mini roster={roster} id={p.id} />
            {roster.name(p.id)}
            <span className="tag" style={{ marginLeft: 6 }}>
              joined mid-game
            </span>
            <span className="tag ok" style={{ marginLeft: "auto" }}>
              enters at dawn
            </span>
          </div>
          <div className="line" style={{ justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              Role when they enter (default Villager)
            </span>
            <RoleSelector
              playerId={p.id}
              name={roster.name(p.id)}
              role={view.roles?.[p.id] ?? "villager"}
              disabled={busy}
              onPick={(role) =>
                void hostAct?.({ type: "ww:setRole", payload: { playerId: p.id, role } })
              }
            />
          </div>
        </div>
      ))}
    </>
  );
}
