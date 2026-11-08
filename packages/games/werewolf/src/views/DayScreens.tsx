import { useEffect, useState } from "react";
import type { ScreenProps } from "./ScreenProps.js";
import { Frame, Mini, fmt, secondsLeft, useNow } from "./shared.jsx";
import { useSfx } from "./sfx-context.js";

/** Day: discussion. The sun is the timer; everyone talks out loud. */
export function DiscussionScreen({ meId, view, roster, serverNow, config }: ScreenProps) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const living = view.players.filter((p) => p.alive && !p.pending);
  return (
    <Frame cls="day">
      <div className="pbody">
        <div className="gtitle">
          <span className="h">Talk it out</span>
          <span className="s">Who is acting like a werewolf?</span>
        </div>
        <div className="sunring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="trk" cx="50" cy="50" r="46" style={{ strokeWidth: 5 }} />
            <circle
              className="prg"
              cx="50"
              cy="50"
              r="46"
              pathLength={100}
              style={{
                strokeWidth: 5,
                stroke: "#ffd36b",
                filter: "none",
                strokeDasharray: `${Math.min(1, left / config.discussionSeconds) * 100} 100`,
              }}
            />
          </svg>
          <i />
          <b>{fmt(left)}</b>
        </div>
        <div className="alive-grid">
          {living.map((p) => (
            <div className="dopt" key={p.id} data-n={p.id}>
              <Mini roster={roster} id={p.id} />
              {p.id === meId ? "You" : roster.name(p.id)}
            </div>
          ))}
        </div>
        <div className="tlk">
          <span>💬</span>Voting opens when the timer ends.
        </div>
      </div>
    </Frame>
  );
}

/**
 * Day: vote. Shows public totals only (never who voted for whom); your own pebble drops into the
 * row you pick, and you can change it until the timer ends.
 */
export function VoteScreen({ meId, view, mine, roster, act, serverNow }: ScreenProps) {
  const left = secondsLeft(view.deadlineAt, useNow(serverNow));
  const sfx = useSfx();
  const [mineVote, setMineVote] = useState<string | null>(mine.myVote);
  useEffect(() => setMineVote(mine.myVote), [mine.myVote]);
  const others = view.players.filter((p) => p.alive && !p.pending && p.id !== meId);
  const slots = (id: string) => {
    const filled = Math.min(view.voteCounts[id] ?? 0, view.needed);
    return Array.from({ length: view.needed }, (_, i) => (
      <i key={i} className={`pb ${i < filled ? "" : "ph"}`} />
    ));
  };
  const vote = (id: string) => {
    if (mineVote === id) return;
    setMineVote(id);
    sfx.play("drop");
    void act({ type: "ww:dayVote", payload: { targetId: id } });
  };
  return (
    <Frame cls="day">
      <div className="pbar">
        <span className="me" />
        <span className="gclock">Vote · {fmt(left)}</span>
      </div>
      <div className="pbody">
        <div className="gtitle">
          <span className="h">Who is a werewolf?</span>
          <span className="s">Pick one player</span>
        </div>
        <div className="need2">
          Needed to banish <b>{view.needed}</b> of {others.length + 1} alive
        </div>
        <div className="nlist">
          {others.map((p) => (
            <div
              key={p.id}
              data-n={p.id}
              className={`dopt ${mineVote === p.id ? "sel" : ""}`}
              onClick={() => vote(p.id)}
            >
              <Mini roster={roster} id={p.id} />
              {roster.name(p.id)}
              <span className="pbs">{slots(p.id)}</span>
            </div>
          ))}
        </div>
        <div className="vp-hint" style={{ marginTop: "auto" }}>
          Only totals are public. You can change your vote until the timer ends.
        </div>
      </div>
    </Frame>
  );
}
