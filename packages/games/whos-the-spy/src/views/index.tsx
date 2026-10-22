import { roundLabel } from "./round.js";
import { HostGroupStatus, HostConfigNote } from "./host.js";
import { ProjectorGroupStatus, ProjectorMemberMark } from "./projector.js";
import { useState } from "react";
import {
  Button,
  Chip,
  Panel,
  SecretCard,
  Timer,
  TurnIndicator,
  type GameViewProps,
  type GameViews,
} from "@cangsplayground/ui";
import type { WhosTheSpyGroupView, WhosTheSpyPublicInfo } from "../types.js";
import "./whos-the-spy.css";

type PlayerProps = GameViewProps & { me: NonNullable<GameViewProps["lobby"]["me"]> };
const categoryName = (category: string) => (category === "food" ? "Food" : "Location");
const dataOf = (group: GameViewProps["group"]) => group.data as WhosTheSpyGroupView;
const nameOf = (lobby: GameViewProps["lobby"], id: string | null) =>
  lobby.players.find((p) => p.id === id)?.name ?? "Player";
function activeMembers({ lobby, group }: GameViewProps) {
  return (lobby.groups.find((g) => g.id === group.groupId)?.playerIds ?? []).filter(
    (id) => !group.eliminated.includes(id),
  );
}
const wait = <p className="cp-muted wts-wait">Wait for your teacher…</p>;

/** This face is mounted by SecretCard only while the player holds the card. */
export function SecretFace({ data }: { data: WhosTheSpyGroupView }) {
  return (
    <span className="wts-secret-face">
      {data.role === "spy" ? (
        <>
          <span className="cp-muted">Your role</span>
          <strong className="wts-secret-title wts-danger">You are the SPY</strong>
          <Chip>Category: {categoryName(data.category)}</Chip>
          <span>Listen well. Guess the topic.</span>
        </>
      ) : (
        <>
          <span className="cp-muted">{categoryName(data.category)}</span>
          <strong className="wts-secret-title">{data.topic?.name}</strong>
          <span className="wts-hints">
            {data.topic?.hints.map((h) => (
              <Chip key={h}>{h}</Chip>
            ))}
          </span>
          <span>Don't say the word.</span>
        </>
      )}
    </span>
  );
}
function PlayerTurnTip({ group }: GameViewProps) {
  return (
    <p>
      {dataOf(group).role === "spy"
        ? "Talk about the topic. Don't get caught."
        : dataOf(group).category === "food"
          ? "Describe the food. Don't say its name."
          : "Describe the place. Don't say its name."}
    </p>
  );
}
function VoteScreen(props: PlayerProps) {
  const { lobby, group, me, act, serverNow } = props,
    data = dataOf(group);
  const [selected, setSelected] = useState<string | null>(null),
    [submitting, setSubmitting] = useState(false);
  const locked = data.myVote,
    active = activeMembers(props),
    paused = group.timer.endsAt === null;
  const targetId = selected && active.includes(selected) ? selected : null;
  const lock = async () => {
    if (!targetId || !act || locked || submitting || paused) return;
    setSubmitting(true);
    try {
      await act({ type: "vote", payload: { targetId } });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Panel className="cp-stack wts-voting">
      <div className="wts-vote-heading">
        <div>
          <h1>Who's the spy?</h1>
          <p className="cp-muted">Vote {data.voteNumber + 1} · Pick one player</p>
        </div>
        <Timer timer={group.timer} serverNow={serverNow} />
      </div>
      {paused && <p className="cp-muted">Game paused. Wait for your teacher…</p>}
      <div className="wts-vote-options" aria-label="Pick one player">
        {active
          .filter((id) => id !== me.playerId)
          .map((id) => (
            <Button
              key={id}
              className={`wts-vote-option ${(locked ?? targetId) === id ? "wts-selected" : ""}`}
              aria-pressed={(locked ?? targetId) === id}
              disabled={!!locked || submitting || paused}
              onClick={() => setSelected(id)}
            >
              {nameOf(lobby, id)}
            </Button>
          ))}
      </div>
      <div className="cp-sticky-action wts-vote-action">
        <p>
          {data.voted.length} of {active.length} voted
        </p>
        <div
          className="wts-vote-progress"
          role="progressbar"
          aria-label="Players who voted"
          aria-valuemin={0}
          aria-valuemax={active.length}
          aria-valuenow={data.voted.length}
        >
          <span
            style={{ width: `${active.length ? (data.voted.length / active.length) * 100 : 0}%` }}
          />
        </div>
        <Button
          variant="primary"
          disabled={!!locked || !targetId || submitting || paused || !act}
          onClick={() => void lock()}
        >
          {locked ? "Vote locked" : "Lock my vote"}
        </Button>
      </div>
    </Panel>
  );
}
function PlayerScreen(props: PlayerProps) {
  const { lobby, group, me, serverNow } = props,
    data = dataOf(group);
  if (!data) return <Panel>Wait for your teacher…</Panel>;
  if (data.result) {
    const isSpy = data.role === "spy",
      won = isSpy ? data.result.winner === "spies" : data.result.winner === "team";
    const lines = {
      caught: isSpy ? "The team found you." : "You found every spy.",
      left: "The last spy left the game.",
      outnumbered: "The spies outnumber the team.",
      time: "Time's up. A spy is still in the game.",
    };
    return (
      <Panel
        className={`cp-stack wts-result ${won ? "wts-win" : "wts-loss"}`}
      >
        <span className="wts-result-symbol" aria-hidden="true">
          {won ? "🎉" : "🕵️"}
        </span>
        <h1>{won ? "You win!" : "You lose"}</h1>
        <p>{data.result.winner === "team" ? "Team wins!" : "Spy wins!"}</p>
        <p className="cp-muted">{lines[data.result.reason]}</p>
        {data.lastVote?.out && (
          <p className="wts-final-verdict">
            {nameOf(lobby, data.lastVote.out)} was voted out:{" "}
            <strong>{data.lastVote.wasSpy ? "was a SPY!" : "was NOT the spy"}</strong>
          </p>
        )}
        <div className="wts-reveal">
          <span className="cp-muted">The topic was</span>
          <strong className="wts-secret-title">{data.topic?.name}</strong>
          <p>
            {(data.spies?.length ?? 0) === 1 ? "Spy" : "Spies"}:{" "}
            {data.spies?.map((id) => nameOf(lobby, id)).join(", ")}
          </p>
        </div>
        {wait}
      </Panel>
    );
  }
  if (
    group.eliminated.includes(me.playerId) &&
    !(group.phase === "ROUND_END" && data.lastVote)
  )
    return (
      <Panel className="cp-stack wts-out">
        <h1>You're out</h1>
        <p>Stay quiet and watch. No talking, no voting.</p>
        <div className="wts-reveal">
          {group.phase === "RUNNING" && group.currentSpeakerId ? (
            <>
              <p>Now speaking: <strong className="cp-person">{nameOf(lobby, group.currentSpeakerId)}</strong></p>
              <Timer timer={group.timer} serverNow={serverNow} />
            </>
          ) : (
            <p>Waiting for your teacher…</p>
          )}
        </div>
        <div className="wts-reveal">
          <span className="cp-muted">Still in</span>
          <p className="cp-person">
            {activeMembers(props)
              .map((id) => nameOf(lobby, id))
              .join(", ")}
          </p>
        </div>
      </Panel>
    );
  if (group.phase === "VOTING")
    return <VoteScreen key={`${group.round}-${data.voteNumber}`} {...props} />;
  if (group.phase === "ROUND_END" && data.lastVote) {
    const last = data.lastVote,
      tally = last.tally ?? {},
      spies = data.spiesLeft ?? 0,
      votedOut = last.out === me.playerId;
    return (
      <Panel className="cp-stack">
        {last.out ? (
          <div className={`wts-verdict ${last.wasSpy ? "wts-caught" : ""}`}>
            <span className="cp-muted">Voted out</span>
            <h1 className="cp-person">{votedOut ? "You" : nameOf(lobby, last.out)}</h1>
            <strong>
              {votedOut
                ? last.wasSpy ? "were a SPY!" : "were NOT the spy"
                : last.wasSpy ? "was a SPY!" : "was NOT the spy"}
            </strong>
          </div>
        ) : (
          <>
            <h1>No one was voted out</h1>
            <p>{Object.values(tally).some((n) => n > 0) ? "It's a tie." : "No votes."}</p>
          </>
        )}
        <ul className="wts-tally">
          {Object.entries(tally)
            .sort((a, b) => b[1] - a[1])
            .map(([id, n]) => (
              <li key={id}>
                <span className="cp-person">{nameOf(lobby, id)}</span>
                <strong>{n}</strong>
              </li>
            ))}
        </ul>
        {votedOut && <p>You're out now. Stay and watch.</p>}
        <p>
          {spies === 1 && last.wasSpy === false
            ? "The spy is still here."
            : `${spies} ${spies === 1 ? "spy" : "spies"} left.`}
        </p>
        <p>2 more rounds, then vote again.</p>
        {wait}
      </Panel>
    );
  }
  return (
    <div className="cp-stack">
      <h1>Who's the Spy</h1>
      <p className="cp-muted">
        Round {group.round} · Category: {categoryName(data.category)}
      </p>
      <SecretCard>
        <SecretFace data={data} />
      </SecretCard>
      <p className="cp-muted wts-wait">Keep your screen away from others.</p>
      {group.phase === "PREPARED" ? (
        <p className="cp-muted wts-wait">Get ready. Hold your card to check it.</p>
      ) : (
        <TurnIndicator
          current={group.currentSpeakerId ? nameOf(lobby, group.currentSpeakerId) : undefined}
          next={group.nextSpeakerId ? nameOf(lobby, group.nextSpeakerId) : undefined}
        />
      )}
    </div>
  );
}
function ProjectorHeader({ session }: { session: GameViewProps["session"] }) {
  const info = session.publicInfo as WhosTheSpyPublicInfo;
  return <div className="wts-projector-category"><Chip>Category: {categoryName(info.category)}</Chip></div>;
}
function ProjectorGroupCard(props: GameViewProps) {
  const data = dataOf(props.group);
  if (!data) return null;
  if (props.group.phase === "FINISHED")
    return <p className={`wts-projector-result ${data.result?.winner === "team" ? "wts-team-result" : "wts-spy-result"}`}>
      {data.result?.winner === "team" ? "Team wins!" : "Spy wins!"}
    </p>;
  if (props.group.phase === "VOTING") return null;
  if (props.group.phase === "ROUND_END")
    return <p className="wts-projector-tip">Wait for your teacher…</p>;
  if (props.group.phase === "PAUSED" || props.session.clock?.timer.pausedRemainingMs != null)
    return <p className="wts-projector-tip">Wait for your teacher…</p>;
  return <p className="wts-projector-tip">Describe the topic. Keep it secret.</p>;
}
function HostGroupPanel({ lobby, group }: GameViewProps) {
  const data = dataOf(group);
  if (!data) return <p>No roles yet</p>;
  return (
    <div className="cp-stack">
      <p>
        {data.spies?.length === 1 ? "Spy" : "Spies"}:{" "}
        {data.spies?.map((id) => nameOf(lobby, id)).join(", ")}
      </p>
      <p>Topic: {data.topic?.name}</p>
      {group.phase === "VOTING" &&
        Object.entries(data.votes ?? {}).map(([id, target]) => (
          <p key={id}>
            {nameOf(lobby, id)} → {nameOf(lobby, target)}
          </p>
        ))}
    </div>
  );
}
export const whosTheSpyViews: GameViews = {
  roundLabel,
  HostGroupStatus,
  HostConfigNote,
  ProjectorGroupStatus,
  ProjectorMemberMark,
  ProjectorHeader,
  ProjectorGroupCard,
  HostGroupPanel,
  PlayerScreen,
  PlayerTurnTip,
  controlLabels: { endRound: "Vote now", nextRound: "Continue", reveal: null },
};
export default whosTheSpyViews;
