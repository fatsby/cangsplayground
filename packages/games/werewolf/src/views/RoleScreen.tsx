import { useState } from "react";
import { REVEAL_MS } from "../types.js";
import type { ScreenProps } from "./ScreenProps.js";
import {
  Frame,
  ROLE_BLURB,
  ROLE_COLOR,
  ROLE_LABEL,
  RoleIcon,
  secondsLeft,
  useNow,
} from "./shared.jsx";
import { useSfx } from "./sfx-context.js";

/**
 * The private role card: hold it to look, let go to hide it. Every role gets the same frame, so a
 * neighbour glancing over sees no colour until the card is held (and then only the icon and name).
 */
export function RoleScreen({ view, mine, roster, serverNow }: ScreenProps) {
  const role = mine.role!;
  const [open, setOpen] = useState(false);
  const sfx = useSfx();
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const hold = (v: boolean) => {
    setOpen(v);
    if (v) sfx.play("flip");
  };
  return (
    <Frame cls="rv">
      <div className="pbody">
        <div className="gtitle">
          <span className="h">Your role</span>
          <span className="s">Hold the card to look. Let go to hide it.</span>
        </div>
        <div
          className={`rcard ${open ? "open" : ""}`}
          tabIndex={0}
          role="button"
          aria-label="Hold to reveal your role"
          onPointerDown={(e) => {
            e.preventDefault();
            hold(true);
          }}
          onPointerUp={() => setOpen(false)}
          onPointerLeave={() => setOpen(false)}
          onPointerCancel={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              hold(!open);
            }
          }}
        >
          <div className="in">
            <div className="f back">
              <RoleIcon role="seer" className="eye" />
              <b>Hold to reveal</b>
              <span>Keep your screen out of sight</span>
            </div>
            <div className="f front" style={{ "--rc": ROLE_COLOR[role] } as React.CSSProperties}>
              <RoleIcon role={role} className="big" />
              <h3>{ROLE_LABEL[role]}</h3>
              <p>{ROLE_BLURB[role]}</p>
              {role === "werewolf" && mine.teammates.length > 0 && (
                <span className="pack">
                  Your pack: {mine.teammates.map((id) => roster.name(id)).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="hide-bar">
          <i
            style={{
              transform: `scaleX(${Math.min(1, left / (REVEAL_MS / 1000))})`,
              transformOrigin: "left",
            }}
          />
        </div>
        <div className="vp-hint">Hides itself in {left} seconds</div>
      </div>
    </Frame>
  );
}
