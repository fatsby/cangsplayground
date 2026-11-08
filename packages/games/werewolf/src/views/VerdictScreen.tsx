import { useEffect, useRef, useState } from "react";
import type { ScreenProps } from "./ScreenProps.js";
import { Frame, Portrait } from "./shared.jsx";
import { shatter } from "./effects.js";
import { useSfx } from "./sfx-context.js";

/**
 * The vote result on a phone: the banished player's candle goes out and their portrait breaks up.
 * The effect is identical whoever was banished; their role stays hidden.
 */
export function VerdictScreen({ view, roster }: Pick<ScreenProps, "view" | "roster">) {
  const vote = view.lastVote!;
  const banished = vote.eliminatedId;
  const stage = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const sfx = useSfx();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    const portrait = stage.current?.querySelector<HTMLElement>(".pt");
    if (banished && portrait) {
      at(() => {
        portrait.classList.add("out");
        sfx.play("lock");
      }, 900);
      at(() => {
        shatter(portrait);
        portrait.classList.add("gone");
        sfx.play("shatter");
      }, 1400);
    }
    at(() => setShow(true), banished ? 1900 : 700);
    return () => timers.forEach(clearTimeout);
  }, [banished]);
  const voters = view.players.filter((p) => p.alive && !p.pending).length + (banished ? 1 : 0);
  return (
    <Frame cls={`vd ${show ? "show" : ""}`}>
      <div className="pbody" style={{ justifyContent: "center" }}>
        <div className="gtitle" style={{ textAlign: "center" }}>
          <span className="s" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>
            The village has decided…
          </span>
        </div>
        <div className="stagep">
          <div className="pbig" ref={stage}>
            {banished && <Portrait roster={roster} id={banished} />}
          </div>
        </div>
        <div className="ctr2">
          {banished ? (
            <>
              <h2>{roster.name(banished).toUpperCase()} IS BANISHED</h2>
              <p>
                {vote.counts[banished] ?? 0} of {voters} votes
              </p>
              <small>Their role stays hidden until the game ends.</small>
            </>
          ) : (
            <>
              <h2>NO ONE IS BANISHED</h2>
              <p>The village could not agree.</p>
              <small>Nobody reached the vote threshold, or two players tied.</small>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}
