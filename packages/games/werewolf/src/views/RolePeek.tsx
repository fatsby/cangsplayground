import { useState, type CSSProperties } from "react";
import type { ScreenProps } from "./ScreenProps.js";
import { ROLE_COLOR, ROLE_LABEL, RoleIcon } from "./shared.jsx";

/**
 * "Hold to see your role": the role card stays available all game. Closed it shows only a neutral
 * hint, so a neighbour glancing over sees nothing; the role appears only while it is held.
 */
export function RolePeek({ mine, roster }: Pick<ScreenProps, "mine" | "roster">) {
  const [open, setOpen] = useState(false);
  const role = mine.role;
  if (!role) return null;
  const close = () => setOpen(false);
  return (
    <div
      className={`rolepeek ${open ? "open" : ""}`}
      role="button"
      tabIndex={0}
      aria-label="Hold to see your role"
      style={{ "--rc": ROLE_COLOR[role] } as CSSProperties}
      onPointerDown={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
      onPointerUp={close}
      onPointerLeave={close}
      onPointerCancel={close}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      <span className="rp-hint">Hold to see your role</span>
      <span className="rp-card">
        <RoleIcon role={role} />
        <b>{ROLE_LABEL[role]}</b>
        {role === "werewolf" && mine.teammates.length > 0 && (
          <span>Your pack: {mine.teammates.map((id) => roster.name(id)).join(", ")}</span>
        )}
      </span>
    </div>
  );
}
