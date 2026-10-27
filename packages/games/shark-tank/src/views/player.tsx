import { useEffect, useRef, useState } from "react";
import type { GameAction, LobbyView } from "@cangsplayground/core";
import {
  Button,
  Chip,
  Input,
  Panel,
  Switch,
  Tabs,
  TeamBadge,
  Timer,
  type SessionViewProps,
} from "@cangsplayground/ui";
import {
  ANSWER_FRAMES,
  CLOSING_FRAME,
  DECISION_FRAMES,
  HUDDLE_FRAMES,
  FRAME_HINTS,
  PART_FRAMES,
  QUESTION_BANK,
  blankCount,
} from "../phrases.js";
import { maxQuantity } from "../rules.js";
import {
  PART_ORDER,
  type CompanyView,
  type Idea,
  type IdeaPublic,
  type PartId,
  type SharkTankView,
} from "../types.js";

type PlayerProps = SessionViewProps & { me: NonNullable<LobbyView["me"]> };
type Send = (action: GameAction) => Promise<boolean>;
const FRAMES_KEY = "cangsplayground:st-frames";
const partNames: Record<PartId, string> = {
  problem: "Problem",
  product: "Product",
  story: "Story",
  price: "Price",
  ask: "Ask",
};
const stageNames = {
  PREP: "Preparation",
  PITCH: "Pitch",
  QA: "Questions and answers",
  HUDDLE: "Team talk",
  DECISION: "Buying decisions",
  RESULTS: "Results",
  CLOSING: "Closing circle",
};

function Vocabulary({ idea }: { idea: Idea | IdeaPublic | null }) {
  if (!idea || !("keywords" in idea)) return null;
  return (
    <details className="st-vocabulary" open>
      <summary>Vocabulary</summary>
      <dl className="st-keywords">
        {idea.keywords.map(({ en, vi }) => (
          <div key={en}>
            <dt>{en}</dt>
            <dd>{vi}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
function Product({ company }: { company: CompanyView }) {
  if (!company.idea) return null;
  return (
    <Panel>
      <span className="st-product-emoji" aria-hidden="true">
        {company.idea.emoji}
      </span>
      <h2>{company.idea.name}</h2>
      <p>{company.idea.pitch}</p>
    </Panel>
  );
}
function BlankHints({ frame }: { frame: string }) {
  const hints = FRAME_HINTS[frame];
  if (!hints?.length) return null;
  return <small className="cp-muted st-blank-hints">Examples: {hints.join(" · ")}</small>;
}
function Frames({ title, frames, hidden }: { title: string; frames: string[]; hidden: boolean }) {
  if (hidden) return null;
  return (
    <Panel>
      <h2>{title}</h2>
      <ul className="st-frames">
        {frames.map((frame) => (
          <li key={frame}>
            {frame}
            <BlankHints frame={frame} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
function scriptText(company: CompanyView, part: PartId, hidden: boolean) {
  const blanks = company.scripts?.[part] ?? [];
  if (hidden) {
    const keywords = part === "price" ? [`$${company.price ?? "___"}`, ...blanks] : blanks;
    return keywords.filter(Boolean).join(" · ") || "Add your own words.";
  }
  let index = 0;
  return PART_FRAMES[part].replace(/___|\{price\}/g, (token) =>
    token === "{price}" ? String(company.price ?? "___") : blanks[index++] || "___",
  );
}
function Script({
  company,
  parts,
  hidden,
  name,
}: {
  company: CompanyView;
  parts: PartId[];
  hidden: boolean;
  name?: (id: string) => string;
}) {
  return (
    <div className="cp-stack">
      {PART_ORDER.filter((part) => parts.includes(part)).map((part) => {
        const speaker = Object.entries(company.parts ?? {}).find(([, assigned]) =>
          assigned.includes(part),
        )?.[0];
        return (
          <Panel key={part}>
            <h2 className="st-player-name">
              {partNames[part]}
              {speaker && name ? ` — ${name(speaker)}` : ""}
            </h2>
            <p className="st-script">{scriptText(company, part, hidden)}</p>
            {!hidden && scriptText(company, part, hidden).includes("___") && (
              <BlankHints frame={PART_FRAMES[part]} />
            )}
          </Panel>
        );
      })}
    </div>
  );
}
function PartEditor({
  company,
  part,
  hidden,
  send,
  disabled,
}: {
  company: CompanyView;
  part: PartId;
  hidden: boolean;
  send: Send;
  disabled: boolean;
}) {
  const saved = Array.from(
    { length: blankCount(PART_FRAMES[part]) },
    (_, i) => company.scripts?.[part]?.[i] ?? "",
  );
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<string[] | null>(null);
  const blanks = draft ?? saved;
  // An acknowledgement may arrive while the next blank is being edited.
  // Clear only a matching draft, so the older save cannot erase newer typing.
  useEffect(() => {
    setDraft((current) => (JSON.stringify(current) === savedKey ? null : current));
  }, [savedKey]);
  return (
    <Panel>
      <h2>{partNames[part]}</h2>
      {!hidden && (
        <p className="st-script">
          {PART_FRAMES[part].replace("{price}", String(company.price ?? "___"))}
        </p>
      )}
      <div className="cp-stack">
        {blanks.map((value, index) => (
          <Input
            key={index}
            label={`${partNames[part]} blank ${index + 1} (e.g. ${FRAME_HINTS[PART_FRAMES[part]]?.[index] ?? "your idea"})`}
            placeholder={`e.g. ${FRAME_HINTS[PART_FRAMES[part]]?.[index] ?? "your idea"}`}
            type="text"
            maxLength={80}
            value={value}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setDraft(blanks.map((v, i) => (i === index ? e.target.value : v)))}
            onBlur={() => {
              const trimmed = blanks.map((v) => v.trim());
              const changed = trimmed.some((v, i) => v !== (company.scripts?.[part]?.[i] ?? ""));
              setDraft(changed ? trimmed : null);
              if (changed) void send({ type: "st:script", payload: { part, blanks: trimmed } });
            }}
          />
        ))}
      </div>
      <small className="cp-muted">Saved when you leave a blank.</small>
    </Panel>
  );
}
function PriceForm({
  price,
  min,
  max,
  discount = false,
  send,
  disabled,
}: {
  price: number | null;
  min: number;
  max: number;
  discount?: boolean;
  send: Send;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState(discount ? "" : String(price ?? ""));
  const value = Number(draft),
    valid = draft.trim() !== "" && Number.isInteger(value) && value >= min && value <= max;
  const label = discount ? "Give a discount" : "Save price";
  return (
    <Panel>
      <form
        className="cp-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !disabled)
            void send({ type: discount ? "st:discount" : "st:price", payload: { price: value } });
        }}
      >
        <Input
          label={discount ? "Discount price" : "Product price"}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled || max < min}
        />
        <p className="cp-muted">
          {max < min
            ? "The price is already at the minimum."
            : `Choose a whole dollar price from $${min} to $${max}.`}
        </p>
        <Button type="submit" variant="primary" disabled={disabled || !valid}>
          {label}
        </Button>
      </form>
    </Panel>
  );
}
function Vote({
  own,
  presenter,
  hidden,
  me,
  name,
  send,
  disabled,
}: {
  own: CompanyView;
  presenter: CompanyView;
  hidden: boolean;
  me: string;
  name: (id: string) => string;
  send: Send;
  disabled: boolean;
}) {
  const cap = presenter.price
    ? maxQuantity(own.members.length, own.wallet ?? 0, presenter.price)
    : 0;
  const initial = own.votes?.[me] ?? 0;
  const [draft, setDraft] = useState(initial);
  const quantity = own.voted ? initial : own.eligible ? Math.max(0, Math.min(draft, cap)) : 0;
  const locked = disabled || !own.eligible || own.voted;
  return (
    <>
      <Frames title="Discuss with your group" frames={HUDDLE_FRAMES} hidden={hidden} />
      <Panel className="cp-stack">
        <h2>How many should your group buy?</h2>
        <p>
          Wallet: <strong>${own.wallet ?? 0}</strong>
        </p>
        <p>
          Still to spend: <strong>${own.minSpendLeft ?? 0}</strong>
        </p>
        {!own.eligible ? (
          <p role="status">Your group cannot buy: nobody asked a question.</p>
        ) : cap === 0 && !own.voted ? (
          <p role="status">Not enough money to buy this.</p>
        ) : null}
        {own.voted && <Chip active>Vote locked</Chip>}
        <div className="st-quantity">
          <Button
            aria-label="Decrease quantity"
            disabled={locked || quantity <= 0}
            onClick={() => setDraft(quantity - 1)}
          >
            −
          </Button>
          <output aria-label="Quantity" aria-live="polite">
            {quantity}
          </output>
          <Button
            aria-label="Increase quantity"
            disabled={locked || quantity >= cap}
            onClick={() => setDraft(quantity + 1)}
          >
            +
          </Button>
        </div>
        {!own.voted && own.eligible && cap > 0 && (
          <p className="cp-muted">
            Maximum: {cap}. The group decision locks when everyone has voted.
          </p>
        )}
        <div className="st-vote-save">
          <Button
            variant="primary"
            disabled={locked}
            onClick={() => void send({ type: "st:vote", payload: { quantity } })}
          >
            Save my vote
          </Button>
        </div>
        <h3>Your group’s votes</h3>
        <ul className="st-player-votes">
          {own.members.map((id) => (
            <li key={id}>
              <span className="st-player-name">{name(id)}</span>
              <span className="st-player-vote-status">: {own.votes?.[id] ?? "Waiting"}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function PhoneTimeUp({
  timer,
  serverNow,
  stageKey,
}: {
  timer: SharkTankView["timer"];
  serverNow: () => number;
  stageKey: string;
}) {
  const [, tick] = useState(0);
  const announced = useRef(new Set<string>());
  const expired =
    timer.durationMs > 0 &&
    timer.pausedRemainingMs === null &&
    timer.endsAt !== null &&
    serverNow() >= timer.endsAt;
  useEffect(() => {
    if (timer.endsAt === null || timer.pausedRemainingMs !== null) return;
    const interval = setInterval(() => tick((value) => value + 1), 250);
    return () => clearInterval(interval);
  }, [timer.endsAt, timer.pausedRemainingMs]);
  useEffect(() => {
    if (expired && !announced.current.has(stageKey)) {
      announced.current.add(stageKey);
      navigator.vibrate?.(200);
    }
  }, [expired, stageKey]);
  return expired ? (
    <p className="st-phone-time-up" role="alert">
      Time's up!
    </p>
  ) : null;
}

export function PlayerSessionScreen({
  lobby,
  session,
  me,
  serverNow,
  act,
  busy = false,
}: PlayerProps) {
  const shared = session.shared as SharkTankView;
  const own = shared.companies.find((c) => c.groupId === me.groupId);
  const presenter = shared.companies.find((c) => c.groupId === shared.presenter);
  const [pending, setPending] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(FRAMES_KEY) === "hidden";
    } catch {
      return false;
    }
  });
  const send: Send = async (action) => {
    if (!act) return false;
    setPending((n) => n + 1);
    try {
      return await act(action);
    } finally {
      setPending((n) => n - 1);
    }
  };
  const disabled = busy || pending > 0 || !act;
  const name = (id: string) => lobby.players.find((p) => p.id === id)?.name ?? "Player";
  const myParts = own?.parts?.[me.playerId] ?? [];
  const presenting = own?.groupId === shared.presenter;
  const stage = shared.stage;
  const next = !own
    ? "Wait for your teacher to place you in a group."
    : stage === "PREP"
      ? [
          "",
          "Read your idea together, then choose a price in step 2.",
          "Agree on a price, save it, then write your parts in step 3.",
          "Fill in your parts, then practise together in step 4.",
          "Practise in speaking order. Wait for your teacher to start the pitches.",
        ][own.prepStep]
      : stage === "PITCH" || stage === "QA"
        ? presenting
          ? stage === "PITCH"
            ? "Speak your parts in order. Wait for your teacher to open questions."
            : "Answer the buyers’ questions. You may give one discount before team talk."
          : stage === "PITCH"
            ? "Listen to the pitch. Get a question ready for Q&A."
            : "Ask a question aloud so your group can buy. Your teacher marks questions."
        : stage === "HUDDLE"
          ? presenting
            ? "Wait. The buyers are deciding."
            : own.voted
              ? "Your vote is locked. Wait for your teacher to open decisions."
              : own.eligible
                ? "Discuss a quantity, then save your vote. Everyone in your group must vote."
                : "Your group cannot buy this product. Listen and wait for the next pitch."
          : stage === "DECISION"
            ? shared.myDecision !== null
              ? "Say your group’s decision aloud and give a reason."
              : "Listen to the announcers. Wait for your teacher to continue."
            : stage === "RESULTS"
              ? "Check your score. Get ready to say what you bought and why."
              : "Take turns saying what you bought and why. Listen to the current speaker.";
  const group = lobby.groups.find((g) => g.id === me.groupId);
  return (
    <div
      className={`cp-stack st-player${stage === "HUDDLE" && !presenting && own ? " st-player-voting" : ""}`}
    >
      <header>
        <div className="cp-row">
          {group && <TeamBadge teamIndex={group.index} />}
          <Chip active>Shark Tank</Chip>
        </div>
        <h1>{stageNames[stage]}</h1>
      </header>
      {["PREP", "PITCH", "QA", "HUDDLE"].includes(stage) && (
        <>
          <Timer timer={shared.timer} serverNow={serverNow} />
          <PhoneTimeUp
            timer={shared.timer}
            serverNow={serverNow}
            stageKey={`${stage}:${shared.presenterIndex ?? shared.presenter ?? "prep"}`}
          />
        </>
      )}
      <Panel>
        <p className="st-next" aria-label="Next step">
          {next}
        </p>
      </Panel>
      <Panel className="cp-stack">
        <Switch
          label="Need help"
          checked={own?.help ?? false}
          disabled={disabled || !own}
          onCheckedChange={(on) => void send({ type: "st:help", payload: { on } })}
        />
        <Switch
          label="Hide sentence frames"
          checked={hidden}
          onCheckedChange={(value) => {
            setHidden(value);
            try {
              localStorage.setItem(FRAMES_KEY, value ? "hidden" : "shown");
            } catch {
              /* Private browsing may deny storage. */
            }
          }}
        />
      </Panel>
      {own && (
        <>
          {own.price !== null && (stage === "PREP" || presenting) && (
            <div className="cp-stack">
              <Chip>Your price: ${own.price}</Chip>
              {own.priceAuto && (
                <p role="status">No price was saved, so your price is ${own.price}.</p>
              )}
            </div>
          )}
          {stage === "PREP" && (
            <>
              <fieldset className="st-step-control" disabled={disabled}>
                <legend className="cp-sr-only">Preparation steps</legend>
                <Tabs
                  className="st-steps"
                  value={String(own.prepStep)}
                  onValueChange={(value) => {
                    if (!disabled) void send({ type: "st:step", payload: { step: Number(value) } });
                  }}
                  items={["Idea", "Price", "Your parts", "Practise"].map((label, i) => ({
                    value: String(i + 1),
                    label: `${i + 1}. ${label}`,
                  }))}
                />
              </fieldset>
              {own.prepStep === 1 && (
                <>
                  <Product company={own} />
                  {own.idea && "sellingPoints" in own.idea && (
                    <Panel>
                      <h2>Selling points</h2>
                      <ul>
                        {own.idea.sellingPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </Panel>
                  )}
                  <Button
                    disabled={disabled || !own.rerollAllowed}
                    onClick={() => void send({ type: "st:reroll" })}
                  >
                    Change idea
                  </Button>
                  {own.rerollAllowed && (
                    <p className="cp-muted">
                      You can change your idea once, before moving past step 1.
                    </p>
                  )}
                </>
              )}
              {own.prepStep === 2 && (
                <PriceForm
                  key={String(own.price)}
                  price={own.price}
                  min={shared.minPrice}
                  max={shared.maxPrice}
                  send={send}
                  disabled={disabled}
                />
              )}
              {own.prepStep === 3 &&
                myParts.map((part) => (
                  <PartEditor
                    key={`${own.groupId}:${part}`}
                    company={own}
                    part={part}
                    hidden={hidden}
                    send={send}
                    disabled={busy || !act}
                  />
                ))}
              {own.prepStep === 4 && (
                <Script
                  company={own}
                  parts={PART_ORDER.filter((part) =>
                    Object.values(own.parts ?? {}).some((parts) => parts.includes(part)),
                  )}
                  hidden={hidden}
                  name={name}
                />
              )}
            </>
          )}
          {(stage === "PITCH" || stage === "QA") &&
            (presenting ? (
              <>
                <Script company={own} parts={myParts} hidden={hidden} />
                {stage === "QA" && (
                  <>
                    <Frames title="Answer a question" frames={ANSWER_FRAMES} hidden={hidden} />
                    {!own.discounted ? (
                      <PriceForm
                        key={String(own.price)}
                        price={own.price}
                        min={shared.minPrice}
                        max={(own.price ?? shared.minPrice) - 1}
                        discount
                        send={send}
                        disabled={disabled}
                      />
                    ) : (
                      <Chip>Discount already given</Chip>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {presenter && (
                  <>
                    <Product company={presenter} />
                    {presenter.price !== null && <Chip>Product price: ${presenter.price}</Chip>}
                  </>
                )}
                <p className="cp-accent">
                  {own.eligible ? "Your group can buy" : "Ask a question so your group can buy"}
                </p>
                <Frames title="Questions to ask" frames={QUESTION_BANK} hidden={hidden} />
              </>
            ))}
          {stage === "HUDDLE" &&
            (presenting ? (
              <Panel>
                <h2>Wait. The buyers are deciding.</h2>
              </Panel>
            ) : (
              presenter && (
                <Vote
                  key={`${presenter.groupId}:${own.voted}:${own.votes?.[me.playerId] ?? "none"}`}
                  own={own}
                  presenter={presenter}
                  hidden={hidden}
                  me={me.playerId}
                  name={name}
                  send={send}
                  disabled={disabled}
                />
              )
            ))}
          {stage === "DECISION" && (
            <Panel>
              {shared.myDecision !== null ? (
                <>
                  <h2>Your group’s decision</h2>
                  <p role="status" className="cp-accent">
                    {shared.myDecision ? "Buying" : "Not buying"}
                  </p>
                  {!hidden && (
                    <>
                      <p className="st-script">
                        {shared.myDecision ? DECISION_FRAMES.buy : DECISION_FRAMES.pass}
                      </p>
                      <BlankHints
                        frame={shared.myDecision ? DECISION_FRAMES.buy : DECISION_FRAMES.pass}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2>Listen to the decisions</h2>
                  {Object.values(shared.announcers ?? {}).map((id) => (
                    <p key={id} className="st-player-name">
                      Listen to {name(id)}
                    </p>
                  ))}
                </>
              )}
            </Panel>
          )}
          {stage === "RESULTS" && (
            <Panel>
              <h2>Your score</h2>
              {shared.results?.scores
                .filter((s) => s.groupId === own.groupId)
                .map((s) => (
                  <dl className="st-score" key={s.groupId}>
                    <div>
                      <dt>Money earned</dt>
                      <dd>${s.revenue}</dd>
                    </div>
                    <div>
                      <dt>Spent</dt>
                      <dd>${s.spent}</dd>
                    </div>
                    <div>
                      <dt>Not spent (penalty)</dt>
                      <dd>${s.shortfall}</dd>
                    </div>
                    <div>
                      <dt>No-question penalty</dt>
                      <dd>${s.noQuestion}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>${s.total}</dd>
                    </div>
                  </dl>
                ))}
            </Panel>
          )}
          {stage === "CLOSING" && (
            <Panel>
              <h2 className="st-player-name">
                {shared.closing?.order[shared.closing.index] === me.playerId
                  ? "Your turn"
                  : shared.closing?.order[shared.closing.index]
                    ? `Listen to ${name(shared.closing.order[shared.closing.index]!)}`
                    : "Wait for your teacher"}
              </h2>
              {!hidden && (
                <>
                  <p className="st-script">{CLOSING_FRAME}</p>
                  <BlankHints frame={CLOSING_FRAME} />
                </>
              )}
            </Panel>
          )}
          <Vocabulary idea={own.idea} />
        </>
      )}
    </div>
  );
}
