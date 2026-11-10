import type { CSSProperties } from "react";
import type { GameAction } from "@cangsplayground/core";
import { validateRoles } from "../rules.js";
import { ROLES, type Role } from "../types.js";
import type { WerewolfView } from "../WerewolfView.js";
import type { Roster } from "./Roster.js";
import { RoleSelector } from "./RoleSelector.js";
import { Mini, ROLE_COLOR, ROLE_LABEL, RoleIcon } from "./shared.jsx";

/**
 * Before the game starts: the host can give any player any role. Start stays disabled, with the
 * reason shown, until the set of roles is valid (see `validateRoles`).
 */
export function RoleEditor({
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
  const roles = view.roles ?? {};
  const problem = validateRoles(roles);
  const count = (role: Role) => Object.values(roles).filter((r) => r === role).length;
  const players = view.players.filter((p) => !p.pending);
  return (
    <div className="hf">
      <div className="hf-h">
        <div>
          <div className="lbl">Host · Setup</div>
        </div>
        <div className="sp">
          <span className="gclock">{players.length} players</span>
        </div>
      </div>
      <div className="hf-b">
        <div className="counts">
          {ROLES.map((r) => (
            <span className="cnt-chip" key={r} style={{ "--rc": ROLE_COLOR[r] } as CSSProperties}>
              <span className="icw">
                <RoleIcon role={r} />
              </span>
              {ROLE_LABEL[r]} <b className="mono">{count(r)}</b>
            </span>
          ))}
        </div>
        <div className={`banner ${problem ? "bad" : "ok"}`}>
          {problem ? "⚠" : "✓"}
          <span>{problem ?? "Roles look good. Starting deals them out and locks them."}</span>
        </div>
        <div className="plist">
          {players.map((p) => (
            <div className="prow" key={p.id}>
              <Mini roster={roster} id={p.id} />
              <span className="nm2">{roster.name(p.id)}</span>
              <RoleSelector
                playerId={p.id}
                name={roster.name(p.id)}
                role={roles[p.id] ?? "villager"}
                disabled={busy}
                onPick={(role) =>
                  void hostAct?.({ type: "ww:setRole", payload: { playerId: p.id, role } })
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="cp-button cp-button-primary cp-button-lg"
          disabled={busy || problem !== null}
          onClick={() => void hostAct?.({ type: "ww:start" })}
        >
          ▶ Start game
        </button>
        <span className="secret-note">
          🔒 Only the host sees this screen. Roles are fixed once the game starts, except for late
          joiners.
        </span>
      </div>
    </div>
  );
}
