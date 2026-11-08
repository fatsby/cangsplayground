import { useMemo } from "react";
import type { ScreenProps } from "./ScreenProps.js";
import {
  Frame,
  Mini,
  ROLE_COLOR,
  ROLE_LABEL,
  colorFor,
  fmt,
  secondsLeft,
  useNow,
} from "./shared.jsx";

const STAGE_LABEL: Record<string, string> = {
  SETUP: "Getting ready",
  REVEAL: "Roles are being dealt",
  NIGHT: "Night",
  DAWN: "Dawn",
  DISCUSSION: "Discussion",
  VOTE: "Vote",
  VERDICT: "The verdict",
};

/** Before the host starts: nothing to do but wait. */
export function SetupScreen() {
  return (
    <Frame cls="wait" starry>
      <div className="pbody" style={{ justifyContent: "center", textAlign: "center" }}>
        <div className="gtitle">
          <span className="h">You're in</span>
          <span className="s">Waiting for the host to start the game.</span>
        </div>
      </div>
    </Frame>
  );
}

/** An eliminated player: can watch the public game but not talk, vote or act. */
export function SpectatorScreen({
  view,
  roster,
  serverNow,
}: Pick<ScreenProps, "view" | "roster" | "serverNow">) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const inPlay = view.players.filter((p) => p.alive && !p.pending);
  const out = view.players.filter((p) => !p.alive);
  return (
    <Frame cls="ghost">
      <div className="pbody">
        <div className="ghostfig">👻</div>
        <div className="gtitle" style={{ textAlign: "center" }}>
          <span className="h" style={{ color: "var(--muted)" }}>
            You're out
          </span>
          <span className="s">Watch quietly. No talking, no voting.</span>
        </div>
        <div className="watch">
          <span className="lbl">Still in ({inPlay.length})</span>
          <div className="dots">
            {inPlay.map((p) => (
              <span className="dotp" key={p.id}>
                <Mini roster={roster} id={p.id} />
                {roster.name(p.id)}
              </span>
            ))}
          </div>
        </div>
        {out.length > 0 && (
          <div className="watch">
            <span className="lbl">Out</span>
            <div className="dots">
              {out.map((p) => (
                <span className="dotp out" key={p.id}>
                  <Mini roster={roster} id={p.id} />
                  {roster.name(p.id)}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="watch">
          <span className="lbl">Now</span>
          <b style={{ fontFamily: "var(--font-display)" }}>
            {STAGE_LABEL[view.stage] ?? view.stage}
            {view.deadlineAt !== null && (
              <>
                {" · "}
                <span className="mono" style={{ color: "var(--accent)" }}>
                  {fmt(left)}
                </span>
              </>
            )}
          </b>
        </div>
      </div>
    </Frame>
  );
}

/** A late joiner waiting at the village gate until the next dawn. */
export function PendingScreen() {
  return (
    <Frame cls="wait" starry>
      <div className="pbody">
        <div className="lantern">
          <i className="rope" />
          <i className="lamp" />
          <i className="gate" />
        </div>
        <div className="gtitle" style={{ textAlign: "center" }}>
          <span className="h">The gates open at dawn</span>
          <span className="s">You'll join the village when morning comes.</span>
        </div>
        <div className="power" style={{ "--c": "#ffb547" } as React.CSSProperties}>
          <span>You're in the lobby. Your role will be revealed when you enter the game.</span>
        </div>
      </div>
    </Frame>
  );
}

/** Game over: did I win, and what was everyone? */
export function FinalScreen({ view, mine, roster }: Pick<ScreenProps, "view" | "mine" | "roster">) {
  const myTeam = mine.role === "werewolf" ? "wolves" : "village";
  const won = view.winner === myTeam;
  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        bg: colorFor(`c${i}`),
        dur: `${3 + ((i * 7) % 30) / 10}s`,
        delay: `${((i * 11) % 30) / 10}s`,
      })),
    [],
  );
  const roles = view.roles ?? {};
  return (
    <Frame cls={`fin ${won ? "won" : "lost"}`}>
      {won && (
        <div className="confetti">
          {confetti.map((c, i) => (
            <i
              key={i}
              style={{
                left: c.left,
                background: c.bg,
                animationDuration: c.dur,
                animationDelay: c.delay,
              }}
            />
          ))}
        </div>
      )}
      <div className="pbody" style={{ paddingTop: 18, gap: 12 }}>
        <div className="fin-title">{won ? "YOU WIN!" : "YOU LOSE"}</div>
        <div className="sub">
          {view.winner === "village"
            ? "The village found every werewolf."
            : "The werewolves took the village."}
        </div>
        <div className="rl">
          {view.players.map((p, i) => {
            const role = roles[p.id];
            return (
              <div key={p.id} style={{ "--i": i } as React.CSSProperties}>
                <Mini roster={roster} id={p.id} />
                {roster.name(p.id)}
                {role && (
                  <span
                    className="tag"
                    style={{
                      color: ROLE_COLOR[role],
                      background: `color-mix(in oklab, ${ROLE_COLOR[role]} 18%, transparent)`,
                    }}
                  >
                    {ROLE_LABEL[role]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}
