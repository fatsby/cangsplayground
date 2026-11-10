import { useEffect, useRef, type CSSProperties } from "react";
import type { SceneProps } from "./SceneProps.js";
import { Portrait, fmt, secondsLeft, useNow, stageSeconds } from "./shared.jsx";
import { stars } from "./effects.js";
import { useSfx } from "./sfx-context.js";

/**
 * The projector at night: moon, sleeping portraits (no role information), the timer, and in the last
 * five seconds a big numeral that slams in each second while the moon reddens and the edges beat.
 */
export function NightScene({ view, roster, serverNow, config }: SceneProps) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow, 200));
  const counting = left > 0 && left <= 5;
  const sky = useRef<HTMLDivElement>(null);
  const sfx = useSfx();
  useEffect(() => {
    if (sky.current && !sky.current.childElementCount) stars(sky.current, 70);
  }, []);
  useEffect(() => {
    if (counting) sfx.play("beat");
  }, [left, counting, sfx]);
  const living = view.players.filter((p) => p.alive && !p.pending);
  const style = counting
    ? ({
        "--k": 6 - left,
        "--bt": `${(1.15 - (5 - left) * 0.14).toFixed(2)}s`,
        "--bl": (6 - left) / 5,
      } as CSSProperties)
    : undefined;
  return (
    <div
      className={`scene sc-night ${counting && left <= 2 ? "tremble" : ""}`}
      data-cd={counting ? "1" : undefined}
      style={style}
    >
      <div className="sky" />
      <div className="stars" ref={sky} />
      <i className="shoot" />
      <div className="fog f1" />
      <div className="fog f2" />
      <div className="moonwrap">
        <svg className="mring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="trk" cx="50" cy="50" r="46" />
          <circle
            className="prg"
            cx="50"
            cy="50"
            r="46"
            pathLength={100}
            style={{
              strokeDasharray: `${Math.min(1, left / stageSeconds(view, config.nightSeconds)) * 100} 100`,
              ...(counting ? { stroke: left <= 3 ? "var(--danger)" : "var(--warning)" } : {}),
            }}
          />
        </svg>
        <div className="moon">
          <i className="cr c1" />
          <i className="cr c2" />
          <i className="cr c3" />
        </div>
      </div>
      <div className="ttl">
        <span className="k">Night {view.night}</span>
        <b>The village sleeps…</b>
      </div>
      <div className="mtime">{fmt(left)}</div>
      <div className="row">
        {living.map((p) => (
          <Portrait key={p.id} roster={roster} id={p.id} cls="sleep" />
        ))}
      </div>
      <div className="vig" />
      <div className="cdlabel">
        <span>Dawn is coming</span>
      </div>
      <div className="cd">
        {counting && (
          <b key={left} className="num">
            {left}
          </b>
        )}
      </div>
    </div>
  );
}
