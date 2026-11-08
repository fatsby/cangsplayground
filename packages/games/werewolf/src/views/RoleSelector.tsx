import type { CSSProperties } from "react";
import { ROLES, type Role } from "../types.js";
import { ROLE_COLOR, ROLE_LABEL, RoleIcon } from "./shared.jsx";

/** Four icon buttons, one per role; the pressed one is the current role. */
export function RoleSelector({
  playerId,
  name,
  role,
  disabled = false,
  onPick,
}: {
  playerId: string;
  name: string;
  role: Role;
  disabled?: boolean;
  onPick: (role: Role) => void;
}) {
  return (
    <div className="seg4">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          style={{ "--rc": ROLE_COLOR[r] } as CSSProperties}
          aria-pressed={r === role}
          aria-label={`${name}: ${ROLE_LABEL[r]}`}
          title={ROLE_LABEL[r]}
          data-set={`${playerId}:${r}`}
          disabled={disabled}
          onClick={() => onPick(r)}
        >
          <RoleIcon role={r} />
        </button>
      ))}
    </div>
  );
}
