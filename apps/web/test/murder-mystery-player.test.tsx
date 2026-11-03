// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import views, {
  ACTION_TIMEOUT_MS,
  REVEAL_TOTAL_MS,
} from "@cangsplayground/game-murder-mystery/views";
import { NOW, leadOf, player, propsFor, submitterOf, type Phase } from "./murder-mystery-fixture";

const Screen = views.PlayerSessionScreen!;
type Props = ReturnType<typeof propsFor>;
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
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

type Options = Parameters<typeof propsFor>[2];
const props = (id: string, phase: Phase, options: Options = {}) =>
  propsFor(player(id), phase, options);
async function mount(p: Props) {
  await act(async () => root.render(<Screen {...p} me={p.me} />));
}
const text = () => container.textContent ?? "";
const all = (selector: string) => [...container.querySelectorAll<HTMLElement>(selector)];
const buttons = (label: string | RegExp) =>
  all("button").filter((b) =>
    typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? ""),
  );
async function click(element: Element) {
  await act(async () => (element as HTMLElement).click());
}
async function hold(card: HTMLElement) {
  await act(async () => {
    card.setPointerCapture = () => {};
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
  });
}
const bodies = (p: Props, ids: string[]) => ids.map((id) => p.shared.caseData.cards[id]!.body);

describe("waiting screens", () => {
  it("READY shows the team and the rules, then waits for the teacher", async () => {
    await mount(props("p1", "READY"));
    expect(text()).toMatch(/Your team solves one case together/);
    expect(text()).toMatch(/Ada \(you\)/);
    expect(text()).toMatch(/Bo/);
    expect(text()).toMatch(/Wait for your teacher to start/);
    expect(all(".cp-secret-card")).toHaveLength(0);
  });

  it("INTRO says to watch the projector and shows no briefing and no clue", async () => {
    const p = props("p1", "INTRO");
    await mount(p);
    expect(text()).toMatch(/Watch the projector/);
    expect(text()).not.toContain(p.shared.caseData.briefing.title);
    expect(all(".cp-secret-card")).toHaveLength(0);
    for (const face of Object.values(p.shared.caseData.cards))
      expect(text()).not.toContain(face.body);
  });

  it("does not crash when the briefing is missing", async () => {
    const p = props("p1", "BRIEFING");
    p.session = { ...p.session, shared: { ...p.view, briefing: null } } as typeof p.session;
    await mount(p);
    expect(text()).toMatch(/case file will open soon/);
    for (const phase of ["READY", "INTRO", "SHARING", "CONCLUSION"] as const) {
      const q = props("p1", phase);
      q.session = { ...q.session, shared: { ...q.view, briefing: null } } as typeof q.session;
      await mount(q);
      expect(text().length).toBeGreaterThan(0);
    }
  });

  it("tells a late joiner to wait for the next case, without any clue", async () => {
    const p = props("late", "INVESTIGATION");
    await mount(p);
    expect(text()).toMatch(/next case/);
    expect(all(".cp-secret-card")).toHaveLength(0);
    expect(buttons(/Yes, investigate/)).toHaveLength(0);
  });

  it("shows the public briefing from BRIEFING", async () => {
    const p = props("p1", "BRIEFING");
    await mount(p);
    const b = p.shared.caseData.briefing;
    expect(text()).toContain(b.title);
    for (const suspect of b.suspects) expect(text()).toContain(suspect.name);
    expect(all(".cp-secret-card")).toHaveLength(0);
  });
});

describe("sharing clues", () => {
  it("shows only the player's own cards, concealed until held", async () => {
    const p = props("p1", "SHARING");
    const team = p.shared.teams[0]!;
    const mine = Object.entries(team.owners)
      .filter(([, o]) => o === "p1")
      .map(([c]) => c);
    const others = Object.keys(team.owners).filter((c) => !mine.includes(c));
    await mount(p);
    expect(all(".cp-secret-card")).toHaveLength(mine.length);
    for (const body of bodies(p, mine)) expect(text()).not.toContain(body);
    await hold(all(".cp-secret-card")[0]!);
    expect(text()).toContain(bodies(p, mine)[0]!);
    for (const body of bodies(p, others)) expect(text()).not.toContain(body);
  });

  it("starts concealed again on a new mount", async () => {
    const p = props("p1", "SHARING");
    await mount(p);
    await hold(all(".cp-secret-card")[0]!);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(p);
    const first = Object.values(p.shared.caseData.cards).map((c) => c.body);
    for (const body of first) expect(text()).not.toContain(body);
  });

  it("lets the help panel toggle even when storage throws", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      await mount(props("p1", "SHARING"));
      expect(text()).toMatch(/Language help/);
      await click(buttons("Hide")[0]!);
      expect(text()).not.toMatch(/Language help/);
      await click(buttons("Show help")[0]!);
      expect(text()).toMatch(/Language help/);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it("remembers a hidden help panel on this phone", async () => {
    await mount(props("p1", "SHARING"));
    await click(buttons("Hide")[0]!);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(props("p1", "SHARING"));
    expect(text()).not.toMatch(/Language help/);
    expect(buttons("Show help")).toHaveLength(1);
  });
});

describe("investigation", () => {
  it("names the leader for peers and gives them nothing to press", async () => {
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const peer = base.shared.teams[0]!.members.find((m) => m !== lead)!;
    await mount(props(peer, "INVESTIGATION"));
    expect(text()).toMatch(/leads Round 1/);
    expect(all(".mm-option")).toHaveLength(0);
    expect(buttons(/Yes, investigate/)).toHaveLength(0);
  });

  it("confirms target, topic and evidence before it dispatches exactly the chosen action", async () => {
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const p = props(lead, "INVESTIGATION");
    await mount(p);
    expect(text()).toMatch(/You lead Round 1/);
    const option =
      p.view.ownTeam!.options.find((o) => o.kind === "challenge") ?? p.view.ownTeam!.options[0]!;
    for (const details of all("details.mm-group")) (details as HTMLDetailsElement).open = true;
    const choice = all(".mm-option").find((b) => b.textContent!.includes(option.prompt))!;
    await click(choice);
    expect(text()).toContain(option.targetLabel);
    expect(text()).toContain(option.prompt);
    for (const e of option.evidence) expect(text()).toContain(e.label);
    expect(p.act).not.toHaveBeenCalled();
    await click(buttons("Yes, investigate")[0]!);
    expect(p.act).toHaveBeenCalledTimes(1);
    expect(p.act).toHaveBeenCalledWith({
      type: "mm:investigate",
      payload: {
        caseInstanceId: p.view.caseInstanceId,
        caseNumber: p.view.caseNumber,
        phaseVersion: p.view.phaseVersion,
        round: 1,
        actionId: option.id,
      },
    });
  });

  it("clears an unconfirmed choice when the phase moves on", async () => {
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const p = props(lead, "INVESTIGATION");
    await mount(p);
    for (const details of all("details.mm-group")) (details as HTMLDetailsElement).open = true;
    await click(all(".mm-option")[0]!);
    expect(buttons("Yes, investigate")).toHaveLength(1);
    const later = {
      ...p,
      session: {
        ...p.session,
        shared: { ...p.view, phaseVersion: p.view.phaseVersion + 1, investigationRound: 2 },
      },
    } as Props;
    await mount(later);
    expect(buttons("Yes, investigate")).toHaveLength(0);
  });

  it("sends once for a double tap and releases on a rejection with a retry message", async () => {
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const p = props(lead, "INVESTIGATION");
    let release!: (ok: boolean) => void;
    p.act.mockImplementation(() => new Promise<boolean>((resolve) => (release = resolve)));
    await mount(p);
    for (const details of all("details.mm-group")) (details as HTMLDetailsElement).open = true;
    await click(all(".mm-option")[0]!);
    const confirm = buttons("Yes, investigate")[0]!;
    await click(confirm);
    await click(confirm);
    expect(p.act).toHaveBeenCalledTimes(1);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release(false));
    expect(text()).toMatch(/That didn't work\. Please try again\./);
    expect((buttons("Yes, investigate")[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("times out after 5 seconds, and a late ack cannot clear a newer pending send", async () => {
    vi.useFakeTimers();
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const p = props(lead, "INVESTIGATION");
    const releases: ((ok: boolean) => void)[] = [];
    p.act.mockImplementation(() => new Promise<boolean>((resolve) => releases.push(resolve)));
    await mount(p);
    for (const details of all("details.mm-group")) (details as HTMLDetailsElement).open = true;
    await click(all(".mm-option")[0]!);
    await click(buttons("Yes, investigate")[0]!);
    await act(async () => vi.advanceTimersByTimeAsync(ACTION_TIMEOUT_MS));
    expect(text()).toMatch(/No reply\./);
    expect((buttons("Yes, investigate")[0] as HTMLButtonElement).disabled).toBe(false);
    await click(buttons("Yes, investigate")[0]!);
    expect(p.act).toHaveBeenCalledTimes(2);
    await act(async () => releases[0]!(true)); // the first send answers late
    expect((buttons("Yes, investigate")[0] as HTMLButtonElement).disabled).toBe(true);
    expect(text()).not.toMatch(/No reply\./);
  });

  it("shows the lead the new clue after the action succeeded", async () => {
    const base = props("p1", "INVESTIGATION");
    const lead = leadOf(base.shared, "g1", 1);
    const before = props(lead, "INVESTIGATION");
    const after = props(lead, "INVESTIGATION", { acted: true });
    expect(after.view.ownTeam!.myCards.length).toBeGreaterThan(before.view.ownTeam!.myCards.length);
    await mount(after);
    expect(text()).toMatch(/Your team has asked/);
    expect(all(".cp-secret-card")).toHaveLength(after.view.ownTeam!.myCards.length);
    expect(all(".mm-option")).toHaveLength(0);
  });
});

describe("conclusion", () => {
  it("matches distinct visible clue references to evidence choices from the same source", async () => {
    const base = props("p1", "CONCLUSION");
    const p = props(submitterOf(base.shared, "g1"), "CONCLUSION");
    const own = p.view.ownTeam!;
    const cards = own.sharedCards!.slice(0, 2).map((card) => ({
      ...card,
      sourceLabel: "Confirmed — The cook",
    }));
    p.session = { ...p.session, shared: { ...p.view, ownTeam: { ...own, sharedCards: cards } } };
    await mount(p);
    const evidence = all('[role="group"][aria-label="With what? evidence"] button');
    expect(evidence[0]!.textContent).toContain("Clue 1");
    expect(evidence[1]!.textContent).toContain("Clue 2");
    for (const [i, card] of cards.entries()) {
      const article = container.querySelector(`article[data-clue="${card.id}"]`)!;
      expect(article.textContent).toContain(`Clue ${i + 1}`);
      expect(article.textContent).toContain(card.body);
    }
    await click(evidence[1]!);
    await click(buttons("Save draft")[0]!);
    expect(p.act.mock.calls[0]![0]).toMatchObject({
      type: "mm:saveDraft",
      payload: { conclusion: { evidence: { weaponId: [cards[1]!.id] } } },
    });
  });

  it("shows every team clue, lets only the submitter edit, and caps evidence at two cards", async () => {
    const base = props("p1", "CONCLUSION");
    const submitter = submitterOf(base.shared, "g1");
    const other = base.shared.teams[0]!.members.find((m) => m !== submitter)!;
    const p = props(submitter, "CONCLUSION");
    await mount(p);
    for (const body of bodies(p, Object.keys(base.shared.teams[0]!.owners))) {
      expect(text()).toContain(body);
    }
    const group = all('[role="group"][aria-label="Who did it? evidence"] button');
    expect(group.length).toBeGreaterThanOrEqual(3);
    for (const button of group.slice(0, 3)) await click(button);
    expect(group.filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(2);

    await mount(props(other, "CONCLUSION"));
    expect(all(".mm-choice")).toHaveLength(0);
    expect(buttons("Save draft")).toHaveLength(0);
    expect(text()).toMatch(/writes the final answer/);
  });

  it("saves with the current draft version, then confirms only after an explicit save", async () => {
    const base = props("p1", "CONCLUSION");
    const submitter = submitterOf(base.shared, "g1");
    const p = props(submitter, "CONCLUSION");
    await mount(p);
    const answers = (label: string) => all(`[role="group"][aria-label="${label} answer"] button`);
    await click(answers("Who did it?")[0]!);
    await click(answers("With what?")[0]!);
    await click(answers("Where?")[0]!);
    for (const label of ["Who did it?", "With what?", "Where?"]) {
      await click(all(`[role="group"][aria-label="${label} evidence"] button`)[0]!);
    }
    expect((buttons("Review and submit")[0] as HTMLButtonElement).disabled).toBe(true);
    await click(buttons("Save draft")[0]!);
    expect(p.act).toHaveBeenCalledTimes(1);
    const call = p.act.mock.calls[0]![0] as { type: string; payload: Record<string, unknown> };
    expect(call.type).toBe("mm:saveDraft");
    expect(call.payload).toMatchObject({
      draftVersion: 0,
      caseInstanceId: p.view.caseInstanceId,
      caseNumber: p.view.caseNumber,
    });

    const saved = props(submitter, "CONCLUSION", { draftSaved: true });
    await mount(saved);
    const review = buttons("Review and submit")[0] as HTMLButtonElement;
    expect(review.disabled).toBe(false);
    await click(review);
    expect(text()).toMatch(/cannot change it after you submit/);
    await click(buttons("Yes, submit")[0]!);
    expect(saved.act).toHaveBeenCalledWith({
      type: "mm:submit",
      payload: {
        caseInstanceId: saved.view.caseInstanceId,
        caseNumber: saved.view.caseNumber,
        phaseVersion: saved.view.phaseVersion,
        draftVersion: 1,
      },
    });
  });

  it("locks the answer once submitted and waits for the reveal", async () => {
    const base = props("p1", "CONCLUSION");
    const submitter = submitterOf(base.shared, "g1");
    await mount(props(submitter, "CONCLUSION", { submitted: true }));
    expect(text()).toMatch(/Your team's answer is locked/);
    expect(buttons("Save draft")).toHaveLength(0);
    await mount(props(submitter, "AWAITING_REVEAL", { submitted: true }));
    expect(text()).toMatch(/Wait for the teacher to reveal/);
  });
});

describe("reveal staging", () => {
  const revealed = (elapsedMs: number) => props("p1", "REVEALED", { submitted: true, elapsedMs });
  const pending = () => all('[data-pending="true"]');
  const total = () => container.querySelector("[data-total]")!.textContent;

  it("starts with the first score line only and the total at zero", async () => {
    await mount(revealed(0));
    expect(all(".mm-score-line").length).toBe(6);
    expect(pending()).toHaveLength(5);
    expect(total()).toBe("0");
  });

  it("shows every line and the final total once the sequence is over", async () => {
    const p = revealed(REVEAL_TOTAL_MS + 1000);
    await mount(p);
    expect(pending()).toHaveLength(0);
    const mine = p.view.results!.find((r) => r.groupId === "g1")!;
    expect(total()).toBe(String(mine.score.total));
  });

  it("shows the final frame at once with reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const p = revealed(0);
    await mount(p);
    expect(pending()).toHaveLength(0);
    expect(total()).toBe(String(p.view.results!.find((r) => r.groupId === "g1")!.score.total));
    vi.unstubAllGlobals();
  });

  it("offers the solution and the scoreboard with ties sharing a rank", async () => {
    const p = revealed(REVEAL_TOTAL_MS + 1000);
    await mount(p);
    await click(buttons("Solution")[0]!);
    for (const event of p.view.reveal!.events) expect(text()).toContain(event);
    await click(buttons("Scoreboard")[0]!);
    expect(all(".mm-row")).toHaveLength(2);
    expect(text()).toMatch(/Team Red/);
  });

  it("does not replay for a device that reconnects after the end", async () => {
    const p = revealed(REVEAL_TOTAL_MS * 3);
    await mount(p);
    expect(pending()).toHaveLength(0);
    expect(NOW).toBeGreaterThan(0);
  });
});
