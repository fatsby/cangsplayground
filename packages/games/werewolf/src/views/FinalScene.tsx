import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Role } from "../types.js";
import type { SceneProps } from "./SceneProps.js";
import { Face, ROLE_COLOR, ROLE_LABEL, RoleIcon } from "./shared.jsx";
import { clawSlash, replay } from "./effects.js";
import { useSfx } from "./sfx-context.js";

const SCRATCHES = ["M8,6 Q50,60 94,136", "M30,2 Q64,52 98,100", "M2,50 Q40,86 70,138"];

/**
 * The end of the game: the cards flip one by one to reveal every role, then the verdict slams in.
 * Werewolves winning bring a blood moon and claw marks across the village's cards; the village
 * winning brings sunrise rays and fireflies.
 */
export function FinalScene({ view, roster }: Pick<SceneProps, "view" | "roster">) {
  const wolves = view.winner === "wolves";
  const roles = view.roles ?? {};
  const players = view.players.filter((p) => !p.pending);
  const won = (role: Role | undefined) =>
    wolves ? role === "werewolf" : role !== undefined && role !== "werewolf";
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const [headIn, setHeadIn] = useState(false);
  const [howl, setHowl] = useState(false);
  const sfx = useSfx();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((res) => timers.push(setTimeout(res, ms)));
    const els = [...cards.current!.querySelectorAll<HTMLElement>(".fc")];
    (async () => {
      await wait(900 + els.length * 60);
      for (const c of els) {
        c.classList.add("flip");
        sfx.play("flip");
        if (c.classList.contains("lose"))
          timers.push(setTimeout(() => c.classList.add("shown"), 520));
        await wait(330);
      }
      await wait(500);
      setHeadIn(true);
      if (wolves) {
        clawSlash(root.current!);
        replay(root.current!, "shake");
        setHowl(true);
        sfx.play("lose");
      } else sfx.play("win");
    })();
    return () => timers.forEach(clearTimeout);
  }, [wolves, sfx]);
  return (
    <div className={`scene sc-final ${wolves ? "wolves" : "village"}`} ref={root}>
      <div className="sky" />
      {wolves ? (
        <>
          <div className="bigmoon" />
          {[0, 1, 2].map((d) => (
            <div
              key={d}
              className={`howl ${howl ? "go" : ""}`}
              style={{ "--hd": `${d}s` } as CSSProperties}
            />
          ))}
          <div className="mist" />
        </>
      ) : (
        <>
          <div className="rays" style={{ animation: "ww-spin 60s linear infinite", opacity: 1 }} />
          {Array.from({ length: 14 }, (_, i) => (
            <i
              key={i}
              className="firefly"
              style={
                {
                  left: `${((i * 41) % 90) + 5}%`,
                  bottom: `${(i * 9) % 30}%`,
                  "--ex": `${((i * 7) % 16) - 8}cqw`,
                  "--fd": `${(i * 5) % 6}s`,
                } as CSSProperties
              }
            />
          ))}
        </>
      )}
      <div className={`head ${headIn ? "in" : ""}`}>
        <h2 className="hl">{wolves ? "THE WOLVES WIN" : "THE VILLAGE WINS"}</h2>
        <p>{wolves ? "The pack outnumbers the village." : "Every werewolf has been found."}</p>
      </div>
      <div className="cards" ref={cards}>
        {players.map((p, i) => {
          const role = roles[p.id];
          const winner = won(role);
          return (
            <div
              key={p.id}
              className={`fc ${p.alive ? "" : "dead"} ${winner ? "win" : "lose"} cl-${wolves ? "wolves" : "village"}`}
              style={
                {
                  "--rc": role ? ROLE_COLOR[role] : "var(--border)",
                  "--ci": `${i * 60}ms`,
                } as CSSProperties
              }
            >
              <div className="fc-in">
                <div className="face q">?</div>
                <div className="face rv">
                  <span className="av">
                    <Face roster={roster} id={p.id} />
                  </span>
                  {role && <RoleIcon role={role} />}
                  <b>{roster.name(p.id)}</b>
                  {role && <small>{ROLE_LABEL[role]}</small>}
                </div>
              </div>
              <svg
                className="scratch"
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {SCRATCHES.map((d, k) => (
                  <path key={k} d={d} pathLength={1} style={{ "--i": k } as CSSProperties} />
                ))}
              </svg>
              <span className="tomb">
                <RoleIcon role="skull" />
              </span>
            </div>
          );
        })}
      </div>
      <div className="foot">Waiting for the host…</div>
    </div>
  );
}
