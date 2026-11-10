import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SceneProps } from "./SceneProps.js";
import { Portrait } from "./shared.jsx";
import { replay, shatter } from "./effects.js";
import { useSfx } from "./sfx-context.js";

const HOPS = [110, 110, 120, 140, 170, 210, 260, 330, 430, 560];
/** Position of the i-th of n portraits on the ring, as percentages of the stage. */
const slot = (i: number, n: number): [number, number] => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return [50 + 33 * Math.cos(a), 53 + 31 * Math.sin(a)];
};

/**
 * The vote result (~8.5 s). A searchlight sweeps the ring of portraits, slows, and locks on the
 * banished player; their candle goes out and the portrait breaks into shards and ash. Identical for
 * every role. If nobody was banished the light wavers between the two closest players and fades.
 */
export function VerdictStage({ view, roster }: Pick<SceneProps, "view" | "roster">) {
  const vote = view.lastVote!;
  const banished = vote.eliminatedId;
  const members = view.players.filter((p) => (p.alive && !p.pending) || p.id === banished);
  const n = members.length;
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const shock = useRef<HTMLDivElement>(null);
  const [headIn, setHeadIn] = useState(false);
  const sfx = useSfx();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((res) => timers.push(setTimeout(res, ms)));
    const nodes = [...ring.current!.querySelectorAll<HTMLElement>(".pt")];
    const light = spot.current!;
    (async () => {
      await wait(1200);
      light.style.opacity = "1";
      const byVotes = Object.entries(vote.counts).sort((a, b) => b[1] - a[1]);
      const indexOf = (id?: string) =>
        Math.max(
          0,
          members.findIndex((p) => p.id === id),
        );
      const tie = banished === null;
      const a = indexOf(byVotes[0]?.[0]);
      const b = byVotes[1] ? indexOf(byVotes[1][0]) : (a + 1) % n;
      const target = indexOf(banished ?? undefined);
      const seq = HOPS.map((_, k) =>
        tie ? (k % 2 ? b : a) : (((target - (HOPS.length - 1 - k)) % n) + n) % n,
      );
      for (let k = 0; k < HOPS.length; k++) {
        const [x, y] = slot(seq[k]!, n);
        light.style.setProperty("--hop", `${HOPS[k]! * 0.9}ms`);
        light.style.left = `${x}%`;
        light.style.top = `${y}%`;
        nodes.forEach((nd, j) => nd.classList.toggle("lit", j === seq[k]));
        sfx.play("tick");
        await wait(HOPS[k]!);
      }
      if (tie) {
        nodes.forEach((nd) => nd.classList.remove("lit"));
        light.style.opacity = "0";
        await wait(900);
        sfx.play("lose");
        setHeadIn(true);
        return;
      }
      const v = nodes[target]!;
      const [x, y] = slot(target, n);
      nodes.forEach((nd, j) => j !== target && nd.classList.add("dim"));
      const wave = shock.current!;
      wave.style.left = `${x}%`;
      wave.style.top = `${y}%`;
      wave.classList.add("go");
      replay(root.current!, "shake");
      sfx.play("lock");
      await wait(1000);
      v.classList.add("out");
      const smoke = document.createElement("i");
      smoke.className = "smoke";
      smoke.style.cssText = `left:calc(${x}% - .8cqw);top:calc(${y}% - 4.6cqw)`;
      ring.current!.appendChild(smoke);
      await wait(420);
      shatter(v);
      v.classList.add("gone");
      light.style.opacity = "0";
      sfx.play("shatter");
      await wait(500);
      setHeadIn(true);
    })();
    return () => timers.forEach(clearTimeout);
    // The sequence runs once per verdict.
  }, [banished, view.night]);
  return (
    <div className={`scene sc-verdict ${banished === null ? "tie" : ""}`} ref={root}>
      <div className="sky" />
      {Array.from({ length: 16 }, (_, i) => (
        <i
          key={i}
          className="ember"
          style={
            {
              left: `${((i * 53) % 90) + 5}%`,
              bottom: `${((i * 7) % 20) - 5}%`,
              "--ex": `${((i * 5) % 12) - 6}cqw`,
              animationDelay: `${((i * 13) % 70) / 10}s`,
            } as CSSProperties
          }
        />
      ))}
      <div className="pre">
        <span>
          The village has decided<i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </div>
      <div className="ring" ref={ring}>
        {members.map((p, i) => {
          const [x, y] = slot(i, n);
          return (
            <Portrait
              key={p.id}
              roster={roster}
              id={p.id}
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          );
        })}
      </div>
      <div className="spot" ref={spot} style={{ left: "50%", top: "53%", opacity: 0 }} />
      <div className="shock" ref={shock} />
      <div className={`head ${headIn ? "in" : ""}`}>
        {banished ? (
          <>
            <h2 className="hl">{roster.name(banished).toUpperCase()} IS BANISHED</h2>
            <p>
              {vote.counts[banished] ?? 0} of {n} votes
            </p>
            <small>Their role stays hidden until the game ends.</small>
          </>
        ) : (
          <>
            <h2 className="hl">NO ONE IS BANISHED</h2>
            <p>The village could not agree.</p>
            <small>Nobody reached {view.needed} votes, or two players tied.</small>
          </>
        )}
      </div>
    </div>
  );
}
