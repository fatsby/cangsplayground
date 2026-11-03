// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import game from "@cangsplayground/game-murder-mystery";
import views, {
  ACTION_TIMEOUT_MS,
  REVEAL_BOARD_START_MS,
} from "@cangsplayground/game-murder-mystery/views";
import { canControl, supportsControl } from "../src/components/game-controls";
import { NOW, propsFor, type Phase } from "./murder-mystery-fixture";

const Host = views.HostSessionPanel!;
const Note = views.HostConfigNote!;
const Projector = views.ProjectorScreen!;
type Props = ReturnType<typeof propsFor>;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
const host = (phase: Phase, options: Options = {}) => propsFor({ kind: "host" }, phase, options);
const projector = (phase: Phase, options: Options = {}) =>
  propsFor({ kind: "projector" }, phase, options);
const mountHost = (p: Props) => act(async () => root.render(<Host {...p} />));
const mountProjector = (p: Props) => act(async () => root.render(<Projector {...p} />));
const text = () => container.textContent ?? "";
const all = (selector: string) => [...container.querySelectorAll<HTMLElement>(selector)];
const buttons = (label: string | RegExp) =>
  all("button").filter((b) =>
    typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? ""),
  );
const click = (element: Element) => act(async () => (element as HTMLElement).click());
const guard = (p: Props) => ({
  caseInstanceId: p.view.caseInstanceId,
  caseNumber: p.view.caseNumber,
  phaseVersion: p.view.phaseVersion,
});

/** A copy of the props whose shared view is patched, for states the reducers cannot reach. */
function patched(p: Props, patch: Record<string, unknown>): Props {
  return { ...p, session: { ...p.session, shared: { ...p.view, ...patch } } } as Props;
}

describe("host controls by phase", () => {
  it("READY offers Start, which dispatches with the current guard", async () => {
    const p = host("READY");
    await mountHost(p);
    await click(buttons("Start")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith({ type: "mm:start", payload: guard(p) });
    expect(text()).toMatch(/13-second intro/);
  });

  it("INTRO has Pause and Skip intro only: no +30s, no confirmation, no Next", async () => {
    const p = host("INTRO");
    await mountHost(p);
    expect(buttons("Pause")).toHaveLength(1);
    expect(buttons("+30s")).toHaveLength(0);
    expect(buttons("Next")).toHaveLength(0);
    await click(buttons("Skip intro")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith({ type: "mm:next", payload: guard(p) });
  });

  it("timed phases show Pause, +30s and Next, and Next asks for confirmation first", async () => {
    const p = host("BRIEFING");
    await mountHost(p);
    await click(buttons("+30s")[0]!);
    expect(p.hostAct).toHaveBeenLastCalledWith({
      type: "mm:extend",
      payload: { ...guard(p), seconds: 30 },
    });
    await click(buttons("Pause")[0]!);
    expect(p.hostAct).toHaveBeenLastCalledWith({ type: "mm:pause", payload: guard(p) });
    await click(buttons("Next")[0]!);
    expect(p.hostAct).toHaveBeenCalledTimes(2);
    await click(buttons(/Yes, move on/)[0]!);
    expect(p.hostAct).toHaveBeenLastCalledWith({ type: "mm:next", payload: guard(p) });
  });

  it("names the unfinished teams and the investigation that would be lost", async () => {
    const dialog = () => container.querySelector('[role="alertdialog"]')!.textContent ?? "";
    const p = host("INVESTIGATION");
    await mountHost(p);
    await click(buttons("Next")[0]!);
    expect(dialog()).toMatch(/Round 1/);
    expect(dialog()).toMatch(/Team Red/);
    expect(dialog()).toMatch(/Team Blue/);
    expect(dialog()).toMatch(/lose/i);
    const done = host("INVESTIGATION", { acted: true });
    await mountHost(done);
    await click(buttons("Next")[0]!);
    expect(dialog()).not.toMatch(/Team Red/);
    expect(dialog()).not.toMatch(/lose/i);
  });

  it("names the teams that have not submitted before leaving the conclusion", async () => {
    const p = host("CONCLUSION", { submitted: true });
    await mountHost(p);
    await click(buttons("Next")[0]!);
    const dialog = container.querySelector('[role="alertdialog"]')!.textContent ?? "";
    expect(dialog).toMatch(/Team Blue/);
    expect(dialog).not.toMatch(/Team Red/);
  });

  it("shows Resume when paused, keeps +30s and disables Next", async () => {
    const base = host("INVESTIGATION");
    const p = patched(base, {
      paused: true,
      clock: { endsAt: null, remainingMs: 90_000, durationMs: 180_000 },
    });
    await mountHost(p);
    expect(buttons("Resume")).toHaveLength(1);
    expect(buttons("Pause")).toHaveLength(0);
    expect((buttons("+30s")[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons("Next")[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("AWAITING_REVEAL offers Reveal, and REVEALED shows shared ranks and New case", async () => {
    const waiting = host("AWAITING_REVEAL", { submitted: true });
    await mountHost(waiting);
    await click(buttons("Reveal")[0]!);
    expect(waiting.hostAct).toHaveBeenCalledWith({ type: "mm:reveal", payload: guard(waiting) });

    const done = host("REVEALED", { submitted: true });
    await mountHost(done);
    expect(buttons("New case")).toHaveLength(1);
    await click(buttons("New case")[0]!);
    expect(done.hostAct).toHaveBeenCalledWith({ type: "mm:newCase", payload: guard(done) });
    const ranks = all(".mm-host-result").map((row) => row.textContent);
    expect(ranks).toHaveLength(2);
  });

  it("renders no generic skip, reveal or next-round control for this module", async () => {
    const p = host("INVESTIGATION");
    for (const cmd of [
      "pause",
      "resume",
      "skip",
      "extend",
      "endRound",
      "reveal",
      "nextRound",
    ] as const) {
      expect(supportsControl(cmd, p.session), cmd).toBe(false);
      expect(canControl(cmd, p.session), cmd).toBe(false);
    }
    expect(game.unsupportedControls).toContain("skip");
  });
});

describe("host reassignment and inspection", () => {
  it("lists only connected teammates as targets and dispatches the exact move", async () => {
    const base = host("INVESTIGATION");
    const team = base.view.hostDetails!.teams[0]!;
    const [a, b, c] = team.members;
    const p = patched(base, {
      hostDetails: {
        ...base.view.hostDetails!,
        teams: base.view.hostDetails!.teams.map((t) =>
          t.groupId === "g1" ? { ...t, connected: [a, b] } : t,
        ),
      },
    });
    await mountHost(p);
    const from = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Move from, Team Red"]',
    )!;
    const to = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Move to, Team Red"]',
    )!;
    await act(async () => {
      from.value = a!;
      from.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const targets = [...to.options].map((o) => o.value).filter(Boolean);
    expect(targets).toEqual([b]);
    expect(targets).not.toContain(c);
    await act(async () => {
      to.value = b!;
      to.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click(buttons("Reassign")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith({
      type: "mm:transfer",
      payload: { ...guard(p), groupId: "g1", fromPlayerId: a, toPlayerId: b },
    });
  });

  it("lets the host inspect the whole case, every card owner and each team's status", async () => {
    const p = host("INVESTIGATION", { acted: true });
    await mountHost(p);
    const details = p.view.hostDetails!;
    for (const card of details.cards.slice(0, 3)) expect(text()).toContain(card.body);
    expect(text()).toContain(details.solution.events[0]!);
    expect(text()).toMatch(/Ada/);
  });
});

describe("host action recovery", () => {
  it("sends once for a double tap, then explains a refusal and allows a retry", async () => {
    const p = host("READY");
    let release!: (ok: boolean) => void;
    p.hostAct.mockImplementation(() => new Promise<boolean>((resolve) => (release = resolve)));
    await mountHost(p);
    const start = buttons("Start")[0]!;
    await click(start);
    await click(start);
    expect(p.hostAct).toHaveBeenCalledTimes(1);
    await act(async () => release(false));
    expect(text()).toMatch(/That didn't work/);
    expect((buttons("Start")[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("recovers from a missing reply after five seconds", async () => {
    vi.useFakeTimers();
    const p = host("READY");
    p.hostAct.mockImplementation(() => new Promise<boolean>(() => {}));
    await mountHost(p);
    await click(buttons("Start")[0]!);
    expect((buttons("Start")[0] as HTMLButtonElement).disabled).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(ACTION_TIMEOUT_MS));
    expect(text()).toMatch(/No reply/);
    expect((buttons("Start")[0] as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("config note", () => {
  it("reports the minutes at defaults and the 3-4 player rule", async () => {
    const p = host("READY");
    await act(async () => root.render(<Note lobby={p.lobby} session={p.session} />));
    expect(text()).toMatch(/21 timed minutes/);
    expect(text()).toMatch(/13-second intro/);
    expect(text()).toMatch(/about 3 minutes/);
    expect(text()).toMatch(/3-4 players/);
    expect(text()).not.toMatch(/needs 3-4 players, but/);
  });

  it("warns about a group with the wrong size", async () => {
    const p = host("READY");
    const lobby = {
      ...p.lobby,
      groups: p.lobby.groups.map((g, i) =>
        i === 0 ? { ...g, playerIds: g.playerIds.slice(0, 2) } : g,
      ),
    };
    await act(async () => root.render(<Note lobby={lobby} session={p.session} />));
    expect(text()).toMatch(/Team Red has 2 players/);
  });
});

describe("projector", () => {
  it("READY shows the teams but no case file", async () => {
    const p = projector("READY");
    await mountProjector(p);
    expect(text()).toMatch(/Team Red/);
    expect(text()).not.toContain(p.shared.caseData.briefing.title);
  });

  it("shows the case file, the clock and per-team progress from BRIEFING without private data", async () => {
    const p = projector("INVESTIGATION", { acted: true });
    await mountProjector(p);
    const b = p.shared.caseData.briefing;
    expect(text()).toContain(b.title);
    expect(text()).toMatch(/Round 1/);
    expect(all(".mm-progress li").length).toBe(2);
    for (const face of Object.values(p.shared.caseData.cards))
      expect(text()).not.toContain(face.body);
    expect(all("button")).toHaveLength(0);
  });

  it("reveals nothing about drafts, answers or scores before Reveal", async () => {
    const p = projector("AWAITING_REVEAL", { submitted: true });
    await mountProjector(p);
    const { answer, events } = p.shared.caseData.reveal;
    expect(text()).not.toContain(events[0]!);
    const names = [...p.shared.caseData.briefing.suspects, ...p.shared.caseData.briefing.rooms]
      .filter((e) => e.id === answer.suspectId || e.id === answer.roomId)
      .map((e) => e.name);
    expect(text()).toMatch(/Waiting for the teacher/);
    expect(names.length).toBeGreaterThan(0);
    expect(all("[data-total]")).toHaveLength(0);
  });

  it("plays the solution story first and switches to the scoreboard by itself", async () => {
    const early = projector("REVEALED", { submitted: true, elapsedMs: 0 });
    await mountProjector(early);
    expect(all(".mm-board")).toHaveLength(0);
    expect(text()).toContain(early.view.reveal!.events[0]!);
    expect(all('[data-pending="true"]').length).toBeGreaterThan(0);

    const late = projector("REVEALED", {
      submitted: true,
      elapsedMs: REVEAL_BOARD_START_MS + 20_000,
    });
    await mountProjector(late);
    expect(all(".mm-board")).toHaveLength(1);
    expect(all('[data-pending="true"]')).toHaveLength(0);
    expect(all("button")).toHaveLength(0);
    const g1 = late.view.results!.find((r) => r.groupId === "g1")!;
    expect(text()).toContain(String(g1.score.total));
    expect(NOW).toBeGreaterThan(0);
  });
});
