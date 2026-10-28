import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import { teamStyle } from "@cangsplayground/core";
import { Chip, Panel, Switch, TeamBadge, Timer, type SessionViewProps } from "@cangsplayground/ui";
import type { SharkTankView } from "../types.js";

export const stageLabels = {
  PREP: "Preparing",
  PITCH: "Pitch",
  QA: "Q&A",
  HUDDLE: "Team talk",
  DECISION: "Decision",
  RESULTS: "Results",
  CLOSING: "I bought…",
};
export const prepLabels = [
  "",
  "Understand your idea",
  "Choose a price",
  "Write your parts",
  "Practise together",
];
const partLabels = {
  problem: "Problem",
  product: "Product",
  story: "Story",
  price: "Price",
  ask: "Ask",
};
const timedStages = new Set(["PREP", "PITCH", "QA", "HUDDLE"]);
const SOUND_KEY = "cangsplayground:st-sound";
const SOUND_EVENT = "cangsplayground:st-sound-change";

function useSound() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const changed = (event: Event) => setEnabled((event as CustomEvent<boolean>).detail);
    const stored = (event: StorageEvent) => {
      if (event.key === SOUND_KEY || event.key === null) setEnabled(event.newValue !== "off");
    };
    window.addEventListener(SOUND_EVENT, changed);
    window.addEventListener("storage", stored);
    return () => {
      window.removeEventListener(SOUND_EVENT, changed);
      window.removeEventListener("storage", stored);
    };
  }, []);
  const change = (value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(SOUND_KEY, value ? "on" : "off");
    } catch {
      /* Keep the in-memory setting when storage is unavailable. */
    }
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: value }));
  };
  return [enabled, change] as const;
}
export function ProjectorTools() {
  const [enabled, change] = useSound();
  return <Switch label="Timer sound" checked={enabled} onCheckedChange={change} />;
}
export function useStageTime(shared: SharkTankView, serverNow: () => number) {
  const [now, setNow] = useState(serverNow);
  const timed = timedStages.has(shared.stage);
  useEffect(() => {
    setNow(serverNow());
    if (!timed) return;
    const id = setInterval(() => setNow(serverNow()), 200);
    return () => clearInterval(id);
  }, [serverNow, timed]);
  const expired =
    timed &&
    ((shared.timer.endsAt !== null && now >= shared.timer.endsAt) ||
      shared.timer.pausedRemainingMs === 0);
  return { timed, expired, now };
}
function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      void context.close().catch(() => {});
    };
    if (context.state === "suspended")
      void context.resume().catch(() => {
        void context.close();
      });
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    /* The visible expiry label remains available without Web Audio. */
  }
}
function Results({ lobby, shared }: Pick<SessionViewProps, "lobby"> & { shared: SharkTankView }) {
  const reduced = useReducedMotion();
  const results = shared.results;
  const count = results?.scores.length ?? 0;
  const [visible, setVisible] = useState(reduced ? count : Math.min(1, count));
  const celebrated = useRef(false);
  useEffect(() => {
    if (reduced) {
      setVisible(count);
      return;
    }
    const id = setInterval(() => setVisible((n) => Math.min(n + 1, count)), 1500);
    return () => clearInterval(id);
  }, [count, reduced]);
  const complete = visible >= count;
  useEffect(() => {
    if (!complete || reduced || celebrated.current || !count) return;
    celebrated.current = true;
    void confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: lobby.groups.map((g) => teamStyle(g.index).neon),
      disableForReducedMotion: true,
    });
  }, [complete, reduced, count, lobby.groups]);
  const badge = (id: string) => (
    <TeamBadge key={id} teamIndex={lobby.groups.find((g) => g.id === id)?.index ?? 0} />
  );
  const award = (ids: string[]) =>
    ids.length > 3 ? (
      <span className="st-award-tie">{ids.length} teams tie</span>
    ) : (
      ids.map(badge)
    );
  return (
    <>
      <p className="st-next">
        {complete
          ? "Celebrate the awards. Get ready for the I bought… round."
          : "Watch the scores appear, from lowest to highest."}
      </p>
      <div className="st-projector-grid" aria-live="polite">
        {results?.scores.slice(0, reduced ? count : visible).map((score) => (
          <Panel className="st-result" key={score.groupId} data-group-id={score.groupId}>
            {badge(score.groupId)}
            <dl className="st-score">
              <div>
                <dt>Money earned</dt>
                <dd>${score.revenue}</dd>
              </div>
              <div>
                <dt>Not spent (penalty)</dt>
                <dd>−${score.shortfall}</dd>
              </div>
              <div>
                <dt>No-question penalty</dt>
                <dd>−${score.noQuestion}</dd>
              </div>
              <div>
                <dt>Final total</dt>
                <dd>{score.total < 0 ? `−$${Math.abs(score.total)}` : `$${score.total}`}</dd>
              </div>
            </dl>
          </Panel>
        ))}
      </div>
      {(complete || reduced) && results && (
        <Panel className="st-awards">
          <h2>Best Startup</h2>
          <div className="cp-row">{award(results.bestStartup)}</div>
          {results.bestShark.length > 0 && (
            <>
              <h2>Best Buyer</h2>
              <div className="cp-row">{award(results.bestShark)}</div>
            </>
          )}
        </Panel>
      )}
    </>
  );
}

export function ProjectorScreen({ lobby, session, serverNow }: SessionViewProps) {
  const shared = session.shared as SharkTankView;
  const { timed, expired, now } = useStageTime(shared, serverNow);
  const reduced = useReducedMotion();
  const [sound] = useSound();
  const notified = useRef<string | null>(null);
  const [flashUntil, setFlashUntil] = useState(0);
  const identity = `${shared.stage}:${shared.presenter ?? ""}`;
  useEffect(() => {
    if (!expired) {
      notified.current = null;
      setFlashUntil(0);
      return;
    }
    if (notified.current === identity) return;
    notified.current = identity;
    if (sound) beep();
    if (!reduced) setFlashUntil(serverNow() + 2000);
  }, [expired, identity, sound, reduced, serverNow]);
  const presenter = shared.companies.find((c) => c.groupId === shared.presenter);
  const presenting = shared.stage === "PITCH" || shared.stage === "QA";
  const closingStart = Math.floor((shared.closing?.index ?? 0) / 12) * 12;
  const name = (id: string) => lobby.players.find((p) => p.id === id)?.name ?? "Player";
  const badge = (id: string) => (
    <TeamBadge teamIndex={lobby.groups.find((g) => g.id === id)?.index ?? 0} />
  );
  return (
    <section
      className={`cp-stack st-projector st-stage-${shared.stage.toLowerCase()} ${!reduced && now < flashUntil ? "st-time-flash" : ""}`}
    >
      <header className="cp-row cp-spread">
        {presenting && presenter ? (
          <div className="cp-row st-presentation-heading">
            {badge(presenter.groupId)}
            <h2 className="st-stage">{stageLabels[shared.stage]}</h2>
          </div>
        ) : (
          <h2 className="st-stage">{stageLabels[shared.stage]}</h2>
        )}
        <div className="cp-row">
          {shared.timer.pausedRemainingMs !== null && (
            <span className="st-paused" role="status">
              Paused
            </span>
          )}
          {expired && (
            <span className="st-time-up" role="status">
              Time's up
            </span>
          )}
          {timed && <Timer className="st-stage-timer" timer={shared.timer} serverNow={serverNow} />}
        </div>
      </header>
      {shared.stage === "PREP" && (
        <>
          <p className="st-next">
            Prepare your pitch together. Your teacher will start the pitches.
          </p>
          <div className="st-projector-grid">
            {shared.companies.map((c) => (
              <Panel key={c.groupId}>
                {badge(c.groupId)}
                <h3>
                  Step {c.prepStep}: {prepLabels[c.prepStep]}
                </h3>
              </Panel>
            ))}
          </div>
        </>
      )}
      {presenting && presenter && (
        <>
          <p className="st-next">
            {shared.stage === "PITCH"
              ? "Listen to the pitch. Get your questions ready."
              : "Ask a question about the product. The presenters answer."}
          </p>
          <Panel className="st-product">
            <span className="st-product-emoji" aria-hidden="true">
              {presenter.idea?.emoji}
            </span>
            <div className="st-product-copy">
              <h2>{presenter.idea?.name}</h2>
              <p className="st-product-pitch">{presenter.idea?.pitch}</p>
              <p className="st-projector-price">
                {presenter.discounted && presenter.originalPrice !== null && (
                  <s>${presenter.originalPrice}</s>
                )}{" "}
                <strong key={presenter.price} className={presenter.discounted ? "st-discount" : ""}>
                  ${presenter.price}
                </strong>
              </p>
              {presenter.priceAuto && <p className="st-auto-price">Price chosen automatically</p>}
            </div>
          </Panel>
          <ul className="st-presenters">
            {presenter.members.map((id) => (
              <li key={id}>
                <strong className="cp-person st-presenter-name" title={name(id)}>
                  {name(id)}
                </strong>
                <span>{presenter.parts?.[id]?.map((part) => partLabels[part]).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {shared.stage === "HUDDLE" && (
        <>
          <p className="st-next">Discuss in your group and save your votes. Presenters wait.</p>
          <div className="st-projector-grid">
            {shared.companies.map((c) => (
              <Panel key={c.groupId}>
                {badge(c.groupId)}
                <p>{c.groupId === shared.presenter ? "Presenting" : c.voted ? "✓ Voted" : null}</p>
              </Panel>
            ))}
          </div>
        </>
      )}
      {shared.stage === "DECISION" && (
        <>
          <p className="st-next">
            Announcers: say whether you are buying and why. Keep the quantity secret.
          </p>
          <div className="st-projector-grid">
            {Object.entries(shared.announcers ?? {}).map(([groupId, id]) => (
              <Panel key={groupId}>
                {badge(groupId)}
                <h2 className="st-announcer cp-person st-name" title={name(id)}>
                  {name(id)}
                </h2>
              </Panel>
            ))}
          </div>
        </>
      )}
      {shared.stage === "RESULTS" && <Results lobby={lobby} shared={shared} />}
      {shared.stage === "CLOSING" && (
        <>
          <p className="st-next">
            Say what you bought and why. Listen while the highlighted person speaks.
            {shared.closing && (
              <span className="st-closing-progress">
                Speaker {shared.closing.index + 1} of {shared.closing.order.length}
              </span>
            )}
          </p>
          <ol className="st-closing-list" start={closingStart + 1}>
            {shared.closing?.order.slice(closingStart, closingStart + 12).map((id, i) => (
              <li
                key={id}
                aria-current={closingStart + i === shared.closing?.index ? "step" : undefined}
              >
                <span className="cp-person st-closing-name" title={name(id)}>
                  {name(id)}
                </span>
                {closingStart + i === shared.closing?.index && <Chip active>Your turn</Chip>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
