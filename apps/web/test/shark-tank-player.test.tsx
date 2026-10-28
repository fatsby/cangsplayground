// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LobbyView } from "@cangsplayground/core";
import {
  ideas,
  PART_FRAMES,
  QUESTION_BANK,
  ANSWER_FRAMES,
  HUDDLE_FRAMES,
  DECISION_FRAMES,
  CLOSING_FRAME,
  type SharkTankView,
  type Stage,
} from "@cangsplayground/game-shark-tank";
import views from "@cangsplayground/game-shark-tank/views";
import { gameViews } from "../src/games/registry";

function fixture(stage: Stage = "PREP") {
  const company = {
    groupId: "g1",
    prepStep: 3 as const,
    members: ["p1", "p2"],
    discounted: false,
    voted: false,
    rerollAllowed: true,
    ideaLocked: false,
    ideaLockVotes: [] as string[],
    startMembers: 3,
    idea: ideas()[0]!,
    price: 30,
    priceAuto: false,
    originalPrice: null,
    parts: { p1: ["problem", "product"] as const, p2: ["price", "ask"] as const },
    help: false,
    scripts: {
      problem: ["feel tired"],
      product: ["a helper", "fly"],
      price: ["a car"],
      ask: ["it helps"],
    },
    wallet: 65,
    minSpendLeft: 40,
    votes: {},
    eligible: false,
    purchases: [],
    revenue: null,
  };
  const shared: SharkTankView = {
    stage,
    presenterIndex: null,
    timer: { endsAt: 60000, pausedRemainingMs: null, durationMs: 60000 },
    minPrice: 10,
    maxPrice: 60,
    presenter: stage === "PREP" ? null : "g2",
    order: ["g2", "g1"],
    companies: [
      { ...company, parts: { p1: ["problem", "product"], p2: ["price", "ask"] } },
      {
        ...company,
        groupId: "g2",
        members: ["p3", "p4"],
        idea: ideas()[1]!,
        price: 30,
        rerollAllowed: null,
        ideaLocked: null,
        ideaLockVotes: null,
        startMembers: null,
        parts: { p3: ["problem", "product"], p4: ["price", "ask"] },
        scripts: null,
        wallet: null,
        minSpendLeft: null,
        votes: null,
        eligible: null,
        help: null,
      },
    ],
    asked: [],
    announcers: null,
    myDecision: null,
    results: null,
    closing: null,
  };
  const lobby: LobbyView = {
    viewer: { kind: "player", playerId: "p1" },
    code: "ABC234",
    status: "open",
    locked: false,
    hostConnected: true,
    createdAt: 0,
    maxPlayers: 60,
    groupsVersion: 1,
    catalog: [],
    warnings: [],
    version: 1,
    players: ["Ada", "Bo", "Cy", "Dee"].map((name, i) => ({
      id: `p${i + 1}`,
      name,
      groupId: i < 2 ? "g1" : "g2",
      connected: true,
      away: false,
    })),
    groups: [
      { id: "g1", index: 0, name: "Team Red", playerIds: ["p1", "p2"] },
      { id: "g2", index: 1, name: "Team Blue", playerIds: ["p3", "p4"] },
    ],
    me: { playerId: "p1", groupId: "g1", name: "Ada" },
    game: {
      gameId: "shark-tank",
      name: "Shark Tank",
      stage: "ACTIVE",
      clock: null,
      config: null,
      publicInfo: null,
      groups: [],
      shared,
    },
  };
  return {
    lobby,
    session: lobby.game!,
    me: lobby.me!,
    serverNow: () => 0,
    act: vi.fn(async () => true),
    shared,
    own: shared.companies[0]!,
  };
}
const Screen = views.PlayerSessionScreen!;
function markup(props = fixture()) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<Screen {...props} />);
  return container;
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "vibrate");
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function mount(props = fixture()) {
  await act(async () => root.render(<Screen {...props} />));
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function edit(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("registers the session player screen", () => {
  expect(gameViews["shark-tank"]).toBe(views);
});
it("PREP 3 shows exactly my assigned frames and one input per blank", () => {
  const screen = markup();
  expect(screen.textContent).toContain(PART_FRAMES.problem);
  expect(screen.textContent).toContain(PART_FRAMES.product);
  expect(screen.textContent).not.toContain("That's cheaper than");
  expect(screen.textContent).not.toContain(PART_FRAMES.story);
  expect(screen.querySelectorAll('input[type="text"]')).toHaveLength(3);
});
it.each([false, true])("QA buyer sees the question bank and live eligibility (%s)", (eligible) => {
  const props = fixture("QA");
  props.own.eligible = eligible;
  const screen = markup(props);
  for (const question of QUESTION_BANK) expect(screen.textContent).toContain(question);
  expect(screen.textContent).toContain(
    eligible ? "Your group can buy" : "Ask a question so your group can buy",
  );
  expect(screen.textContent).toContain(props.shared.companies[1]!.idea!.name);
});
it("HUDDLE ineligible locks the quantity at zero", () => {
  const screen = markup(fixture("HUDDLE"));
  expect(screen.textContent).toContain("Your group cannot buy: nobody asked a question.");
  expect(
    screen.querySelector('button[aria-label="Increase quantity"]')?.hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.querySelector("output")?.textContent).toBe("0");
});
it.each([true, false])("DECISION announcer sees the matching frame (%s)", (buy) => {
  const props = fixture("DECISION");
  props.shared.myDecision = buy;
  const text = markup(props).textContent;
  expect(text).toContain(buy ? DECISION_FRAMES.buy : DECISION_FRAMES.pass);
  expect(text).not.toContain(buy ? DECISION_FRAMES.pass : DECISION_FRAMES.buy);
});
it("DECISION listeners see the announcer names", () => {
  const props = fixture("DECISION");
  props.shared.announcers = { g1: "p2", g2: "p3" };
  expect(markup(props).textContent).toContain("Listen to Bo");
});
it.each(["PREP", "PITCH", "QA", "HUDDLE", "DECISION", "RESULTS", "CLOSING"] as Stage[])(
  "always offers Need help, frame visibility and a next step in %s",
  (stage) => {
    const screen = markup(fixture(stage));
    expect(screen.textContent).toContain("Need help");
    expect(screen.textContent).toContain("Hide sentence frames");
    expect(screen.querySelector('[aria-label="Next step"]')?.textContent).toBeTruthy();
  },
);
it("PREP 1 shows full vocabulary and selling points, and respects the reroll lock", async () => {
  const props = fixture();
  props.own.prepStep = 1;
  await mount(props);
  const idea = ideas()[0]!;
  for (const k of idea.keywords) {
    expect(container.textContent).toContain(k.en);
    expect(container.textContent).toContain(k.vi);
  }
  for (const point of idea.sellingPoints) expect(container.textContent).toContain(point);
  await click(button("Change idea"));
  expect(props.act).toHaveBeenCalledWith({ type: "st:reroll" });
  props.own.rerollAllowed = false;
  await mount(props);
  expect(button("Change idea").disabled).toBe(true);
});
it("PREP tabs send the member's selected step", async () => {
  const props = fixture();
  await mount(props);
  const tab = [...container.querySelectorAll('[role="tab"]')][1]!;
  await act(async () =>
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })),
  );
  expect(props.act).toHaveBeenCalledWith({ type: "st:step", payload: { step: 2 } });
});
it("PREP Idea lets a member vote once and disables changes when locked", async () => {
  const props = fixture();
  props.own.prepStep = 1;
  props.own.members = ["p1", "p2", "p5"];
  props.own.ideaLockVotes = [];
  props.own.ideaLocked = false;
  await mount(props);
  expect(container.textContent).toContain("0 / 2 votes");
  await click(button("Lock idea"));
  expect(props.act).toHaveBeenCalledWith({
    type: "st:lockIdea",
    payload: { ideaId: props.own.idea!.id },
  });
  props.own.ideaLockVotes = ["p1"];
  await mount(props);
  expect(button("Voted to lock idea").disabled).toBe(true);
  expect(button("Change idea").disabled).toBe(false);
  props.own.ideaLockVotes = ["p1", "p2"];
  props.own.ideaLocked = true;
  props.own.rerollAllowed = false;
  await mount(props);
  expect(button("Lock idea")).toBeUndefined();
  expect(button("Voted to lock idea")).toBeUndefined();
  expect(container.textContent).not.toContain("votes");
  expect(container.textContent).toContain("Your group’s idea is locked.");
  expect(button("Change idea").disabled).toBe(true);
});
it("PREP needs no lock vote after the group's only idea change", async () => {
  const props = fixture();
  props.own.prepStep = 1;
  props.own.rerollAllowed = false;
  props.own.ideaLocked = true;
  props.own.ideaLockVotes = [];
  await mount(props);
  expect(button("Change idea").disabled).toBe(true);
  expect(button("Lock idea")).toBeUndefined();
  expect(container.textContent).not.toContain("votes");
  expect(container.textContent).toContain("Your group’s idea is locked.");
});
it("saves a full part's blanks on blur, never on each keystroke", async () => {
  const props = fixture();
  await mount(props);
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  await edit(inputs[1]!, "a robot");
  expect(props.act).not.toHaveBeenCalled();
  await act(async () => inputs[1]!.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(props.act).toHaveBeenCalledWith({
    type: "st:script",
    payload: { part: "product", blanks: ["a robot", "fly"] },
  });
});
it("PREP 2 validates prices against the public bounds", async () => {
  const props = fixture();
  props.own.prepStep = 2;
  await mount(props);
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  expect(input.min).toBe("10");
  expect(input.max).toBe("60");
  await edit(input, "61");
  expect(button("Save price").disabled).toBe(true);
  await edit(input, "25");
  await click(button("Save price"));
  expect(props.act).toHaveBeenCalledWith({ type: "st:price", payload: { price: 25 } });
});
it("keeps the price Save action beside the input and scrolls it into view on focus", async () => {
  const props = fixture();
  props.own.prepStep = 2;
  await mount(props);
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  const save = button("Save price");
  expect(input.closest(".st-price-form-row")).toBe(save.closest(".st-price-form-row"));
  const scrollIntoView = vi.fn();
  input.scrollIntoView = scrollIntoView;
  await act(async () => input.focus());
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
});
it("scrolls a PREP script blank into view when focused", async () => {
  const props = fixture();
  await mount(props);
  const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
  const scrollIntoView = vi.fn();
  input.scrollIntoView = scrollIntoView;
  await act(async () => input.focus());
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
});
it("PREP 4 orders the filled group script and names each speaker", () => {
  const props = fixture();
  props.own.prepStep = 4;
  const text = markup(props).textContent!;
  expect(text).toContain("Do you ever feel tired?");
  expect(text).toContain("It costs $30. That's cheaper than a car.");
  expect(text).toContain("Ada");
  expect(text).toContain("Bo");
  expect(text.indexOf("feel tired")).toBeLessThan(text.indexOf("a helper"));
  expect(text.indexOf("a helper")).toBeLessThan(text.indexOf("a car"));
});
it("presenters get their filled script and QA answers with one valid discount", async () => {
  const props = fixture("QA");
  props.shared.presenter = "g1";
  await mount(props);
  expect(container.textContent).toContain("Do you ever feel tired?");
  for (const frame of ANSWER_FRAMES) expect(container.textContent).toContain(frame);
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  expect(input.max).toBe("29");
  await edit(input, "30");
  expect(button("Give a discount").disabled).toBe(true);
  await edit(input, "20");
  await click(button("Give a discount"));
  expect(props.act).toHaveBeenCalledWith({ type: "st:discount", payload: { price: 20 } });
  props.own.discounted = true;
  await mount(props);
  expect(container.querySelector('input[type="number"]')).toBeNull();
});
it("HUDDLE caps votes by the wallet and current members, then locks voted groups", async () => {
  const props = fixture("HUDDLE");
  props.own.eligible = true;
  props.own.votes = { p2: 1 };
  await mount(props);
  for (const frame of HUDDLE_FRAMES) expect(container.textContent).toContain(frame);
  expect(container.textContent).toContain("Bo: 1");
  expect(container.textContent).toContain("$65");
  expect(container.textContent).toContain("$40");
  await click(container.querySelector('[aria-label="Increase quantity"]')!);
  await click(container.querySelector('[aria-label="Increase quantity"]')!);
  expect(container.querySelector("output")?.textContent).toBe("2");
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.disabled,
  ).toBe(true);
  await click(button("Save my vote"));
  expect(props.act).toHaveBeenCalledWith({ type: "st:vote", payload: { quantity: 2 } });
  props.own.wallet = 300;
  props.own.voted = true;
  props.own.votes = { p1: 2, p2: 1 };
  await mount(props);
  expect(container.textContent).toContain("Vote locked");
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.disabled,
  ).toBe(true);
});
it("allows an explicit zero vote and reduces the cap after a leaver", async () => {
  const props = fixture("HUDDLE");
  props.own.eligible = true;
  props.own.wallet = 300;
  await mount(props);
  await click(button("Save my vote"));
  expect(props.act).toHaveBeenCalledWith({ type: "st:vote", payload: { quantity: 0 } });
  for (let i = 0; i < 3; i++)
    await click(container.querySelector('[aria-label="Increase quantity"]')!);
  expect(container.querySelector("output")?.textContent).toBe("2");
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.disabled,
  ).toBe(true);
});
it("keeps the locked vote visible after the purchase reduces the wallet", () => {
  const props = fixture("HUDDLE");
  props.own.eligible = true;
  props.own.voted = true;
  props.own.wallet = 5;
  props.own.votes = { p1: 2, p2: 2 };
  expect(markup(props).querySelector("output")?.textContent).toBe("2");
});
it("keeps a newer edit when an earlier blur save is broadcast back", async () => {
  const props = fixture();
  await mount(props);
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  await edit(inputs[1]!, "a robot");
  await act(async () => inputs[1]!.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  await edit(inputs[2]!, "dance");
  props.own.scripts = { ...props.own.scripts, product: ["a robot", "fly"] };
  await mount(props);
  const updated = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
  expect(updated[2]!.value).toBe("dance");
  await act(async () => updated[2]!.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(props.act).toHaveBeenLastCalledWith({
    type: "st:script",
    payload: { part: "product", blanks: ["a robot", "dance"] },
  });
});
it("does not put a script blank into an unset price", () => {
  const props = fixture();
  props.own.prepStep = 4;
  props.own.price = null;
  expect(markup(props).textContent).toContain("It costs $___. That's cheaper than a car.");
});
it("updates untouched blanks from a fresh shared view after a focus and blur", async () => {
  const props = fixture();
  await mount(props);
  const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
  await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  props.own.scripts = { ...props.own.scripts, problem: ["lose your keys"] };
  await mount(props);
  expect(container.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe(
    "lose your keys",
  );
});
it.each([true, false])("keeps the buying decision clear with frames hidden (%s)", (buy) => {
  localStorage.setItem("cangsplayground:st-frames", "hidden");
  const props = fixture("DECISION");
  props.shared.myDecision = buy;
  const screen = markup(props);
  const text = screen.textContent!;
  expect(text).not.toContain(buy ? DECISION_FRAMES.buy : DECISION_FRAMES.pass);
  expect(screen.querySelector('[role="status"]')?.textContent).toBe(buy ? "Buying" : "Not buying");
});
it("HUDDLE presenters wait without a buying control", () => {
  const props = fixture("HUDDLE");
  props.shared.presenter = "g1";
  const screen = markup(props);
  expect(screen.textContent).toContain(
    "Other teams are choosing how many to buy. (Nhóm khác đang chọn số lượng mua.)",
  );
  expect(screen.textContent).not.toContain("Wait. The buyers are deciding.");
  expect(screen.textContent?.match(/Other teams are choosing how many to buy/g)).toHaveLength(1);
  expect(screen.querySelector("output")).toBeNull();
});
it("RESULTS shows the own group's score breakdown", () => {
  const props = fixture("RESULTS");
  props.shared.results = {
    scores: [{ groupId: "g1", revenue: 120, spent: 60, shortfall: 10, noQuestion: 20, total: 90 }],
    bestStartup: ["g1"],
    bestShark: [],
  };
  const text = markup(props).textContent!;
  for (const label of [
    "Money earned",
    "Spent",
    "Not spent (penalty)",
    "No-question penalty",
    "Total",
  ])
    expect(text).toContain(label);
  for (const value of [120, 60, 10, 20, 90]) expect(text).toContain(`$${value}`);
});
it("shows a negative player score with the minus before the dollar sign", () => {
  const props = fixture("RESULTS");
  props.shared.results = {
    scores: [{ groupId: "g1", revenue: 0, spent: 380, shortfall: 0, noQuestion: 0, total: -380 }],
    bestStartup: [],
    bestShark: [],
  };
  const text = markup(props).textContent!;
  expect(text).toContain("−$380");
  expect(text).not.toContain("$-380");
});
it.each([0, 1])("CLOSING distinguishes speaking and listening (%s)", (index) => {
  const props = fixture("CLOSING");
  props.shared.closing = { order: ["p1", "p2"], index };
  const text = markup(props).textContent!;
  expect(text).toContain(CLOSING_FRAME);
  expect(text).toContain(index === 0 ? "Your turn" : "Listen to Bo");
});
it("sends the Need help toggle without changing the game step", async () => {
  const props = fixture("QA");
  await mount(props);
  const help = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
  await click(help);
  expect(props.act).toHaveBeenCalledWith({ type: "st:help", payload: { on: true } });
});
it("persists hidden frames while retaining vocabulary, blanks and filled content", async () => {
  const props = fixture();
  await mount(props);
  await click(container.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1]!);
  expect(localStorage.getItem("cangsplayground:st-frames")).toBe("hidden");
  expect(container.textContent).not.toContain(PART_FRAMES.problem);
  expect(container.querySelectorAll('input[type="text"]')).toHaveLength(3);
  expect(container.textContent).toContain(ideas()[0]!.keywords[0]!.en);
  await act(async () => root.unmount());
  root = createRoot(container);
  await mount(props);
  expect(container.textContent).not.toContain(PART_FRAMES.problem);
  props.own.prepStep = 4;
  await mount(props);
  expect(container.textContent).toContain("feel tired");
  expect(container.textContent).toContain("$30");
  expect(container.textContent).not.toContain("Do you ever");
});
it("survives denied localStorage reads and writes", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  await mount();
  await click(container.querySelectorAll<HTMLButtonElement>('[role="switch"]')[1]!);
  expect(container.textContent).toContain("Hide sentence frames");
});

it.each(["quick", "blur"])("saves the typed price with a %s save", async (mode) => {
  const props = fixture();
  props.own.prepStep = 2;
  await mount(props);
  const input = container.querySelector<HTMLInputElement>('input[type="number"]')!;
  await edit(input, "47");
  if (mode === "blur")
    await act(async () => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  await click(button("Save price"));
  expect(props.act).toHaveBeenCalledExactlyOnceWith({ type: "st:price", payload: { price: 47 } });
});
it.each(["PITCH", "QA"] as const)(
  "shows one own price chip and the auto-price explanation in %s",
  (stage) => {
    const props = fixture(stage);
    props.shared.presenter = "g1";
    props.own.priceAuto = true;
    props.own.discounted = true;
    const screen = markup(props);
    expect(
      [...screen.querySelectorAll(".cp-chip")].filter(
        (chip) => chip.textContent === "Your price: $30",
      ),
    ).toHaveLength(1);
    expect(screen.textContent).toContain("No price was saved, so your price is $30.");
    expect(screen.textContent).not.toContain("Discount already given — price:");
  },
);
it("shows a buyer only the presenter's price during QA, not their own", () => {
  const props = fixture("QA");
  props.own.priceAuto = true;
  const screen = markup(props);
  expect(screen.textContent).not.toContain("Your price");
  expect(screen.textContent).not.toContain("No price was saved");
  expect(screen.textContent).toContain("Product price: $");
});
it.each([
  [false, 300, "Your group cannot buy: nobody asked a question."],
  [true, 5, "Not enough money to buy this."],
] as const)(
  "explains why buying is unavailable (eligible %s, wallet %s)",
  (eligible, wallet, reason) => {
    const props = fixture("HUDDLE");
    props.own.eligible = eligible;
    props.own.wallet = wallet;
    const screen = markup(props);
    expect(screen.textContent).toContain(reason);
    expect(screen.textContent).not.toContain("Maximum: 0");
  },
);
it("hides the change-idea hint after the group uses its reroll", () => {
  const props = fixture();
  props.own.prepStep = 1;
  props.own.rerollAllowed = false;
  expect(markup(props).textContent).not.toContain("You can change your idea once");
});
it("shows examples for every editable blank", () => {
  const screen = markup();
  for (const input of screen.querySelectorAll<HTMLInputElement>('input[type="text"]'))
    expect(input.placeholder).toMatch(/^e.g. .+/);
});
it.each(["PREP", "PITCH", "QA", "HUDDLE"] as const)(
  "announces time up and vibrates once per stage in %s",
  async (stage) => {
    vi.useFakeTimers();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    const props = fixture(stage);
    let now = 0;
    props.serverNow = () => now;
    props.shared.timer = { endsAt: 1000, pausedRemainingMs: null, durationMs: 1000 };
    await mount(props);
    expect(container.textContent).not.toContain("Time's up!");
    now = 1000;
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Time's up!");
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(200);
    await act(async () => vi.advanceTimersByTime(2000));
    await mount(props);
    expect(vibrate).toHaveBeenCalledTimes(1);
    props.shared.timer = { endsAt: null, pausedRemainingMs: 0, durationMs: 1000 };
    await mount(props);
    expect(container.textContent).not.toContain("Time's up!");
    props.shared.timer = { endsAt: 1000, pausedRemainingMs: null, durationMs: 1000 };
    props.shared.stage = stage === "QA" ? "HUDDLE" : "QA";
    await mount(props);
    expect(vibrate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  },
);
it.each([false, true])("locks HUDDLE voting at expiry and unlocks after an extension (saved %s)", async (saved) => {
  vi.useFakeTimers();
  const props = fixture("HUDDLE");
  props.own.eligible = true;
  props.own.voted = saved;
  props.own.votes = saved ? { p1: 1 } : {};
  let now = 0;
  props.serverNow = () => now;
  props.shared.timer = { endsAt: 1000, pausedRemainingMs: null, durationMs: 1000 };
  await mount(props);
  now = 1000;
  await act(async () => vi.advanceTimersByTime(1000));
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Decrease quantity"]')!.disabled).toBe(true);
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.disabled).toBe(true);
  expect(button("Save my vote").disabled).toBe(true);
  expect(container.textContent).toContain("Time's up. Your vote is closed.");
  expect(container.textContent).toContain(saved ? "Your saved vote counts." : "You did not vote in time.");

  props.shared.timer = { endsAt: 5000, pausedRemainingMs: null, durationMs: 5000 };
  await mount(props);
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Increase quantity"]')!.disabled).toBe(saved);
  expect(button("Save my vote").disabled).toBe(saved);
  if (!saved) {
    await click(button("Save my vote"));
    expect(props.act).toHaveBeenCalledWith({ type: "st:vote", payload: { quantity: 0 } });
  }
  vi.useRealTimers();
});
