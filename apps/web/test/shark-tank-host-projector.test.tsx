// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRng, type LobbyView } from "@cangsplayground/core";
import sharkTank, {
  configSchema,
  type SharkTankView,
  type Stage,
} from "@cangsplayground/game-shark-tank";
import views from "@cangsplayground/game-shark-tank/views";

const effects = vi.hoisted(() => ({ reduced: false, confetti: vi.fn(), beep: vi.fn() }));
vi.mock("motion/react", () => ({ useReducedMotion: () => effects.reduced }));
vi.mock("canvas-confetti", () => ({ default: effects.confetti }));

function fixture(role: "host" | "projector" = "projector", stage: Stage = "HUDDLE") {
  const config = configSchema.parse({});
  const groups = [0, 1, 2].map((index) => ({
    groupId: `g${index + 1}`,
    playerIds: [`p${index * 2 + 1}`, `p${index * 2 + 2}`],
    round: 1,
  }));
  const raw = sharkTank.prepareShared!({ config, groups, rng: createRng(1), now: 0 });
  raw.stage = stage;
  raw.order = ["g1", "g2", "g3"];
  raw.presenterIndex = 0;
  raw.timer = { endsAt: 1000, pausedRemainingMs: null, durationMs: 1000 };
  raw.companies.forEach((company) => {
    company.price = 40;
    company.prepStep = 2;
  });
  raw.companies[1]!.wallet = 120;
  raw.companies[1]!.help = true;
  raw.votes = { g2: { p3: 2, p4: 2 } };
  raw.locked = ["g2"];
  raw.asked = { g1: ["p3"] };
  raw.purchases = [{ buyer: "g2", seller: "g1", quantity: 2, price: 40 }];
  raw.announcers = { g2: "p3", g3: "p5" };
  raw.closing = { order: ["p1", "p2", "p3"], index: 1 };
  const lobby: LobbyView = {
    viewer: { kind: role },
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
    me: null,
    groups: groups.map((g, index) => ({
      id: g.groupId,
      index,
      name: `Team ${index + 1}`,
      playerIds: g.playerIds,
    })),
    players: ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay"].map((name, i) => ({
      id: `p${i + 1}`,
      name,
      groupId: `g${Math.floor(i / 2) + 1}`,
      connected: true,
      away: false,
    })),
    game: {
      gameId: "shark-tank",
      name: "Shark Tank",
      stage: "ACTIVE",
      clock: null,
      config: role === "host" ? config : null,
      publicInfo: null,
      groups: [],
    },
  };
  const refresh = () => {
    lobby.game!.shared = sharkTank.sharedViewFor!({
      config,
      shared: raw,
      viewer: lobby.viewer,
      viewerGroupId: null,
    });
  };
  refresh();
  return {
    lobby,
    session: lobby.game!,
    raw,
    refresh,
    serverNow: () => Date.now(),
    hostAct: vi.fn(async () => true),
  };
}
const Projector = views.ProjectorScreen!;
const Host = views.HostSessionPanel!;
const Note = views.HostConfigNote!;
function markup(props = fixture(), host = false) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(host ? <Host {...props} /> : <Projector {...props} />);
  return container;
}
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  effects.reduced = false;
  effects.confetti.mockReset();
  effects.beep.mockReset();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      state = "running";
      destination = {};
      createOscillator() {
        return {
          connect: vi.fn(),
          frequency: { value: 0 },
          start: effects.beep,
          stop: vi.fn(),
          onended: null,
        };
      }
      createGain() {
        return {
          connect: vi.fn(),
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        };
      }
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});
async function mount(props = fixture(), host = false) {
  await act(async () => root.render(host ? <Host {...props} /> : <Projector {...props} />));
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
function button(text: string) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}

it("HUDDLE projector exposes vote completion without financial amounts or quantities", () => {
  const props = fixture();
  const screen = markup(props);
  expect(screen.textContent).toContain("Voted");
  expect(screen.textContent).not.toContain("$120");
  expect(screen.textContent).not.toContain("$80");
  expect(screen.textContent).not.toMatch(/Wallet|Revenue|quantity|purchases/i);
  expect(
    [...screen.textContent!.matchAll(/\$\d+/g)].map((m) => m[0]).filter((s) => s !== "$40"),
  ).toEqual([]);
});
it("PREP projector shows steps without product ideas, scripts or prices", () => {
  const props = fixture("projector", "PREP");
  const screen = markup(props);
  expect(screen.textContent).toContain("Preparing");
  expect(screen.textContent).toContain("Choose a price");
  expect(screen.textContent).not.toContain("$");
  expect(screen.querySelector(".st-product")).toBeNull();
});
it.each(["PITCH", "QA"] as const)(
  "%s projector shows the public product and speaker parts",
  (stage) => {
    const props = fixture("projector", stage);
    const text = markup(props).textContent!;
    expect(text).toContain("Ada");
    expect(text).toContain("Problem");
    expect(text).toContain("Product");
    expect(text).toContain("$40");
    expect(text).not.toContain("$120");
  },
);
it("retains the original price across a projector reconnect after discount", () => {
  const props = fixture("projector", "QA");
  const next = sharkTank.onSharedAction!({
    config: configSchema.parse({}),
    shared: props.raw,
    roster: [],
    now: 0,
    rng: createRng(1),
    actor: { kind: "player", playerId: "p1" },
    action: { type: "st:discount", payload: { price: 25 } },
  })!;
  props.session.shared = sharkTank.sharedViewFor!({
    config: configSchema.parse({}),
    shared: next,
    viewer: { kind: "projector" },
    viewerGroupId: null,
  });
  const screen = markup(props);
  expect(screen.querySelector("s")?.textContent).toBe("$40");
  expect(screen.textContent).toContain("$25");
});
it("DECISION announces names without revealing purchase quantities", () => {
  const text = markup(fixture("projector", "DECISION")).textContent!;
  expect(text).toContain("Cy");
  expect(text).toContain("Eli");
  expect(text).not.toContain("$");
});
it("RESULTS reveals scores in order, then awards and one confetti burst", async () => {
  const props = fixture("projector", "RESULTS");
  await mount(props);
  const scores = (props.session.shared as SharkTankView).results!.scores;
  expect(container.querySelectorAll(".st-result")).toHaveLength(1);
  expect(container.textContent).not.toContain("Best Startup");
  await advance(1500);
  expect(container.querySelectorAll(".st-result")).toHaveLength(2);
  await advance(1500);
  expect(container.querySelectorAll(".st-result")).toHaveLength(3);
  expect(
    [...container.querySelectorAll(".st-result")].map((el) => el.getAttribute("data-group-id")),
  ).toEqual(scores.map((s) => s.groupId));
  expect(container.textContent).toContain("Best Startup");
  expect(container.textContent).toContain("Best Buyer");
  expect(container.textContent).not.toMatch(/Ada|Bo|Cy|Dee|Eli|Fay/);
  expect(effects.confetti).toHaveBeenCalledTimes(1);
  await mount(props);
  expect(effects.confetti).toHaveBeenCalledTimes(1);
});
it("RESULTS shows all results and Best Startup immediately under reduced motion", () => {
  effects.reduced = true;
  const props = fixture("projector", "RESULTS");
  const screen = markup(props);
  expect(screen.querySelectorAll(".st-result")).toHaveLength(3);
  expect(screen.textContent).toContain("Best Startup");
});
it("omits Best Buyer when the award is empty", () => {
  effects.reduced = true;
  const props = fixture("projector", "RESULTS");
  (props.session.shared as SharkTankView).results!.bestShark = [];
  expect(markup(props).textContent).not.toContain("Best Buyer");
});
it("CLOSING highlights the current speaker", () => {
  const screen = markup(fixture("projector", "CLOSING"));
  expect(screen.querySelector('[aria-current="step"]')?.textContent).toContain("Bo");
  expect(screen.textContent).toContain("I bought…");
});
it("host QA chips contain each non-presenter member, with asked marks", async () => {
  const props = fixture("host", "QA");
  await mount(props, true);
  const chips = container.querySelectorAll("button[aria-pressed]");
  expect([...chips].map((c) => c.textContent)).toEqual(["Cy", "Dee", "Eli", "Fay"]);
  expect(chips[0]!.getAttribute("aria-pressed")).toBe("true");
  await click(chips[1] as HTMLElement);
  expect(props.hostAct).toHaveBeenCalledWith({ type: "st:asked", payload: { playerId: "p4" } });
});
it("host HUDDLE disables asked chips for locked groups", async () => {
  const props = fixture("host");
  await mount(props, true);
  const chips = container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]");
  expect(chips[0]!.disabled).toBe(true);
  expect(chips[1]!.disabled).toBe(true);
  expect(chips[2]!.disabled).toBe(false);
});
it.each([
  ["PREP", "Start pitches"],
  ["PITCH", "Start Q&A"],
  ["QA", "Start team talk"],
  ["HUDDLE", "Show decisions"],
  ["DECISION", "Next group"],
  ["RESULTS", "I bought… round"],
  ["CLOSING", "Next speaker"],
] as const)("host main button for %s sends a guarded Next action", async (stage, label) => {
  const props = fixture("host", stage);
  await mount(props, true);
  await click(button(label));
  expect(props.hostAct).toHaveBeenCalledWith({
    type: "st:next",
    payload: { from: stage, presenterIndex: 0 },
  });
});
it("host DECISION offers Show results on the final remaining group", () => {
  const props = fixture("host", "DECISION");
  props.raw.presenterIndex = 1;
  props.raw.companies[2]!.members = [];
  props.refresh();
  expect(markup(props, true).textContent).toContain("Show results");
});
it("uses the host view's presenter index after the first pitch", async () => {
  const props = fixture("host", "QA");
  props.raw.presenterIndex = 1;
  props.refresh();
  await mount(props, true);
  await click(button("Start team talk"));
  expect(props.hostAct).toHaveBeenCalledWith({
    type: "st:next",
    payload: { from: "QA", presenterIndex: 1 },
  });
});
it("disables every host button while busy", async () => {
  const props = fixture("host", "QA");
  await act(async () => root.render(<Host {...props} busy />));
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.length).toBeGreaterThan(4);
  expect(buttons.every((b) => b.disabled)).toBe(true);
});
it("disables Next speaker after the last closing speaker", () => {
  const props = fixture("host", "CLOSING");
  props.raw.closing!.index = 2;
  props.refresh();
  const next = [...markup(props, true).querySelectorAll("button")].find(
    (b) => b.textContent === "Next speaker",
  )!;
  expect(next.disabled).toBe(true);
});
it("host shows missing-price warnings, financial status and help clearing", async () => {
  const props = fixture("host", "PREP");
  props.raw.companies[0]!.price = null;
  props.refresh();
  await mount(props, true);
  expect(container.textContent).toContain("Price not set");
  expect(container.textContent).toContain("$120");
  expect(container.textContent).toContain("$80");
  await click(button("Clear help"));
  expect(props.hostAct).toHaveBeenCalledWith({ type: "st:clearHelp", payload: { groupId: "g2" } });
});
it("host timer buttons send Pause, Resume and +30s", async () => {
  const props = fixture("host", "QA");
  await mount(props, true);
  await click(button("Pause"));
  expect(props.hostAct).toHaveBeenCalledWith({ type: "st:pause" });
  await click(button("+30s"));
  expect(props.hostAct).toHaveBeenCalledWith({ type: "st:extend" });
  props.raw.timer = { endsAt: null, pausedRemainingMs: 1000, durationMs: 1000 };
  props.refresh();
  await mount(props, true);
  await click(button("Resume"));
  expect(props.hostAct).toHaveBeenCalledWith({ type: "st:resume" });
});
it("host config note uses group sizes and draft money per member", () => {
  const props = fixture("host", "PREP");
  props.lobby.groups = [
    { ...props.lobby.groups[0]!, playerIds: ["a", "b", "c", "d"] },
    { ...props.lobby.groups[1]!, playerIds: ["e", "f", "g"] },
  ];
  const render = () => renderToStaticMarkup(<Note {...props} />);
  expect(render()).toContain("Group 1 (4): $400 · Group 2 (3): $300");
  props.session.config = { moneyPerMember: 150 };
  expect(render()).toContain("Group 1 (4): $600 · Group 2 (3): $450");
});
it("projector expiry shows Time's up, flashes for 2 seconds and beeps only once", async () => {
  const props = fixture();
  await mount(props);
  await advance(1000);
  expect(container.textContent).toContain("Time's up");
  expect(container.querySelector(".st-time-flash")).not.toBeNull();
  expect(effects.beep).toHaveBeenCalledTimes(1);
  await advance(2000);
  expect(container.querySelector(".st-time-flash")).toBeNull();
  await advance(1000);
  expect(effects.beep).toHaveBeenCalledTimes(1);
  expect(props.hostAct).not.toHaveBeenCalled();
});
it("host shows the same expiry label without a beep", async () => {
  await mount(fixture("host"), true);
  await advance(1000);
  expect(container.textContent).toContain("Time's up");
  expect(effects.beep).not.toHaveBeenCalled();
});
it("rearms the expiry notification after a timer extension", async () => {
  const props = fixture();
  await mount(props);
  await advance(1000);
  expect(effects.beep).toHaveBeenCalledTimes(1);
  props.raw.timer.endsAt = 2000;
  props.raw.timer.durationMs = 2000;
  props.refresh();
  await mount(props);
  expect(container.textContent).not.toContain("Time's up");
  await advance(1000);
  expect(effects.beep).toHaveBeenCalledTimes(2);
});
it("restores a muted sound preference on a fresh projector mount", async () => {
  localStorage.setItem("cangsplayground:st-sound", "off");
  await mount();
  await advance(1000);
  expect(container.textContent).toContain("Time's up");
  expect(effects.beep).not.toHaveBeenCalled();
});
it("reduced motion disables projector flashes and confetti", async () => {
  effects.reduced = true;
  await mount();
  await advance(1000);
  expect(container.querySelector(".st-time-flash")).toBeNull();
  expect(container.textContent).toContain("Time's up");
  await mount(fixture("projector", "RESULTS"));
  expect(effects.confetti).not.toHaveBeenCalled();
});
it("the projector tools mute sound, persist it and update the active screen", async () => {
  const props = fixture();
  const Tools = views.ProjectorTools!;
  await act(async () =>
    root.render(
      <>
        <Projector {...props} />
        <Tools {...props} />
      </>,
    ),
  );
  const sound = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(sound.getAttribute("aria-checked")).toBe("true");
  await click(sound);
  expect(localStorage.getItem("cangsplayground:st-sound")).toBe("off");
  await advance(1000);
  expect(effects.beep).not.toHaveBeenCalled();
});
it("sound reads and writes tolerate unavailable storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  const props = fixture();
  const Tools = views.ProjectorTools!;
  await act(async () =>
    root.render(
      <>
        <Projector {...props} />
        <Tools {...props} />
      </>,
    ),
  );
  await click(container.querySelector<HTMLButtonElement>('[role="switch"]')!);
  await advance(1000);
  expect(effects.beep).not.toHaveBeenCalled();
});

it("host HUDDLE counts current members' saved votes, including zero, and shows locks", () => {
  const props = fixture("host");
  props.raw.votes.g2 = { p3: 0, formerMember: 2 };
  props.refresh();
  const screen = markup(props, true);
  const rows = screen.querySelectorAll("tbody tr");
  expect(rows[1]!.textContent).toContain("1/2 voted");
  expect(rows[1]!.textContent).toContain("✓ Locked");
  expect(rows[2]!.textContent).toContain("0/2 voted");
  expect(rows[2]!.textContent).toContain("Can't buy (no question)");
});
it("host HUDDLE readiness excludes the presenter, empty and ineligible groups", async () => {
  const props = fixture("host");
  props.raw.asked.g1 = ["p3", "p5"];
  props.raw.votes.g3 = { p5: 0 };
  props.refresh();
  await mount(props, true);
  await click(button("Lock votes (1/2 groups ready)"));
  expect(props.hostAct).toHaveBeenCalledWith({
    type: "st:next",
    payload: { from: "HUDDLE", presenterIndex: 0 },
  });
  props.raw.locked.push("g3");
  props.refresh();
  expect(markup(props, true).textContent).toContain("Show decisions");
  props.raw.locked = [];
  props.raw.companies[2]!.members = [];
  props.refresh();
  expect(markup(props, true).textContent).toContain("Lock votes (0/1 groups ready)");
  props.raw.asked.g1 = [];
  props.refresh();
  expect(markup(props, true).textContent).toContain("Show decisions");
});
it.each(["PITCH", "QA"] as const)(
  "%s projector identifies an automatically chosen price",
  (stage) => {
    const props = fixture("projector", stage);
    props.raw.companies[0]!.priceAuto = true;
    props.refresh();
    const screen = markup(props);
    expect(screen.querySelector(".st-projector-price")?.textContent).toContain("$40");
    expect(screen.textContent).toContain("Price chosen automatically");
    props.raw.companies[0]!.priceAuto = false;
    props.refresh();
    expect(markup(props).textContent).not.toContain("Price chosen automatically");
  },
);
it("host identifies an automatically chosen price in the status table", () => {
  const props = fixture("host", "PITCH");
  props.raw.companies[0]!.priceAuto = true;
  props.refresh();
  expect(markup(props, true).querySelector("tbody tr")?.textContent).toContain(
    "Price chosen automatically",
  );
});
it("projector labels a paused timer and removes the label on resume", async () => {
  const props = fixture("projector", "QA");
  props.raw.timer = { endsAt: null, pausedRemainingMs: 700, durationMs: 1000 };
  props.refresh();
  await mount(props);
  expect(container.querySelector('[role="status"]')?.textContent).toBe("Paused");
  await advance(2000);
  expect(container.textContent).not.toContain("Time's up");
  props.raw.timer = { endsAt: 4000, pausedRemainingMs: null, durationMs: 1000 };
  props.refresh();
  await mount(props);
  expect(container.textContent).not.toContain("Paused");
});
it("projector avoids claiming an ineligible group is discussing when eligibility is private", () => {
  const props = fixture();
  const shared = props.session.shared as SharkTankView;
  expect(shared.companies[2]!.eligible).toBeNull();
  expect(shared.asked).toBeNull();
  expect(markup(props).textContent).not.toContain("Discussing");
});
it("CLOSING keeps the current speaker visible in a bounded page for a full classroom", () => {
  const props = fixture("projector", "CLOSING");
  props.raw.closing = { order: Array.from({ length: 60 }, (_, i) => `p${i + 1}`), index: 58 };
  props.refresh();
  const screen = markup(props);
  expect(screen.querySelectorAll(".st-closing-list li")).toHaveLength(12);
  const current = screen.querySelectorAll('[aria-current="step"]');
  expect(current).toHaveLength(1);
  expect(screen.querySelectorAll(".st-closing-list .cp-chip")).toHaveLength(1);
  expect(current[0]!.querySelector(".cp-chip")).not.toBeNull();
  expect(screen.textContent).toContain("Speaker 59 of 60");
});
