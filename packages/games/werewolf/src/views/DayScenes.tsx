import { useEffect, useState } from "react";
import type { SceneProps } from "./SceneProps.js";
import { Portrait, RingClock, secondsLeft, useNow } from "./shared.jsx";
import { useSfx } from "./sfx-context.js";

/** Day: discussion. The sun is the clock; portraits take turns lighting up as if talking (decoration only). */
export function TalkScene({ view, roster, serverNow, config }: SceneProps) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const living = view.players.filter((p) => p.alive && !p.pending);
  const [talking, setTalking] = useState<string | null>(null);
  useEffect(() => {
    const t = setInterval(
      () => setTalking(living[Math.floor(Math.random() * living.length)]?.id ?? null),
      1400,
    );
    return () => clearInterval(t);
  }, [living.length]);
  return (
    <div className="scene sc-talk">
      <div className="sky" />
      <div className="ttl">
        <span className="k">Day {view.night} · Discussion</span>
        <b>Talk it out</b>
      </div>
      <RingClock left={left} total={config.discussionSeconds} cls="sunc" />
      <div className="grid">
        {living.map((p) => (
          <Portrait
            key={p.id}
            roster={roster}
            id={p.id}
            cls={`rel ${talking === p.id ? "talk" : ""}`}
            bubble
          />
        ))}
      </div>
      <div className="hint">Voting opens when the timer ends.</div>
    </div>
  );
}

/**
 * Day: vote. Pebbles drop from above into each player's slots; there is no line from a voter to
 * their choice, so nobody learns who voted for whom. A player who has reached the threshold glows.
 */
export function VoteScene({ view, roster, serverNow, config }: SceneProps) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const sfx = useSfx();
  const living = view.players.filter((p) => p.alive && !p.pending);
  const needed = Math.max(1, view.needed);
  const total = Object.values(view.voteCounts).reduce((a, b) => a + b, 0);
  useEffect(() => {
    if (total > 0) sfx.play("drop");
  }, [total, sfx]);
  useEffect(() => {
    if (view.deadlineAt !== null && left === 0) sfx.play("slam");
  }, [left, view.deadlineAt, sfx]);
  return (
    <div className="scene sc-vote">
      <div className="sky" />
      <div className="ttl">
        <span className="k">Day {view.night} · Vote</span>
        <b>Who is a werewolf?</b>
      </div>
      <div className="need">
        Needed to banish: <b>{needed}</b>
        <span>half of {living.length} alive, rounded up</span>
      </div>
      <RingClock left={left} total={config.voteSeconds} cls="clk" />
      <div className="cols">
        {living.map((p) => {
          const count = view.voteCounts[p.id] ?? 0;
          return (
            <div className={`vcol ${count >= needed ? "reached" : ""}`} key={p.id} data-n={p.id}>
              <Portrait roster={roster} id={p.id} cls="rel" />
              <div className="slots">
                {Array.from({ length: needed }, (_, i) => (
                  <i key={i} className={`slot ${i < count ? "on" : ""}`}>
                    <b />
                  </i>
                ))}
              </div>
              <span className="cnt">
                {count} / {needed}
              </span>
            </div>
          );
        })}
      </div>
      <div className={`locked ${view.deadlineAt !== null && left === 0 ? "in" : ""}`}>
        VOTES LOCKED
      </div>
      <div
        style={{
          left: 0,
          right: 0,
          bottom: "1.4cqw",
          textAlign: "center",
          fontSize: "1.25cqw",
          fontWeight: 600,
          color: "rgb(255 255 255 / .55)",
        }}
      >
        Only totals are public. Votes can change until the timer ends.
      </div>
    </div>
  );
}
