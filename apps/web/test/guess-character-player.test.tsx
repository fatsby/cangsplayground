// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import views, { ACTION_TIMEOUT_MS } from "@cangsplayground/game-guess-the-character/views";
import { gameViews } from "../src/games/registry";
import { NOW, propsFor, type Phase } from "./guess-character-fixture";

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

const player = (id: string) => ({ kind: "player" as const, playerId: id });
function props(id: string, phase: Phase, options: Parameters<typeof propsFor>[2] = {}) {
  return propsFor(player(id), phase, options);
}
async function mount(p: Props) {
  await act(async () => root.render(<Screen {...p} me={p.me} />));
}
const text = () => container.textContent ?? "";
const buttons = (label: string | RegExp) =>
  [...container.querySelectorAll("button")].filter((b) =>
    typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? ""),
  );
async function click(element: Element) {
  await act(async () => (element as HTMLElement).click());
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  const form = container.querySelector("form")!;
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
const card = () => container.querySelector(".cp-secret-card") as HTMLElement;
async function pointer(type: string) {
  await act(async () => {
    card().setPointerCapture = () => {};
    card().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1 }));
  });
}

it("registers the guess-the-character views", () => {
  expect(gameViews["guess-the-character"]).toBe(views);
  expect((views.PlayerScreen as (p: never) => unknown)({} as never)).toBeNull();
});

describe("waiting and voting", () => {
  it("READY shows the pairing and waits for the teacher", async () => {
    await mount(props("p1", "READY"));
    // The shell header shows my team; the screen names the opponent.
    expect(container.querySelector(".gc-opponent")!.textContent).toBe("vsTeam Blue");
    expect(text()).toMatch(/Wait for your teacher to start/);
    expect(card()).toBeNull();
  });

  it("lists all nine categories with examples, a countdown and the vote count", async () => {
    const p = props("p1", "CATEGORY_VOTE");
    await mount(p);
    const options = container.querySelectorAll(".gc-category");
    expect(options).toHaveLength(9);
    for (const option of options) expect(option.textContent).toMatch(/e\.g\. \S/);
    expect(text()).not.toContain("undefined");
    expect(container.querySelector('[role="timer"]')!.getAttribute("aria-label")).toBe("0:30");
    expect(text()).toContain("0/4 voted");
    expect(card()).toBeNull();
    await click(options[2]!);
    const m = p.view.matches[0]!;
    expect(p.act).toHaveBeenCalledWith({
      type: "gc:vote",
      payload: {
        round: 1,
        matchId: m.id,
        phaseVersion: m.phaseVersion,
        categoryId: "classic-cartoons",
      },
    });
  });

  it("marks my current vote and lets me change it", async () => {
    const p = props("p1", "CATEGORY_VOTE");
    p.view.myVote = "anime-manga";
    await mount(p);
    const pressed = container.querySelector('.gc-category[aria-pressed="true"]')!;
    expect(pressed.textContent).toContain("Anime & Manga");
    expect(text()).toContain("Your vote: Anime & Manga");
    await click(container.querySelectorAll(".gc-category")[0]!);
    expect(p.act).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ categoryId: "superheroes" }) }),
    );
  });

  it("disables voting after the server deadline and while paused", async () => {
    await mount(props("p1", "CATEGORY_VOTE", { now: NOW + 30_000 }));
    expect(
      [...container.querySelectorAll(".gc-category")].every(
        (b) => (b as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
  });

  it("late joiners and other spectators see a waiting message", async () => {
    const p = propsFor(player("late"), "PLAYING");
    await mount(p);
    expect(text()).toMatch(/next round/);
    expect(text()).not.toContain("Thor");
    expect(text()).not.toContain("Spider-Man");
  });
});

describe("playing", () => {
  it("the current questioner has an enabled I'm done that sends the exact turn guard", async () => {
    const p = props("p1", "PLAYING");
    await mount(p);
    const m = p.view.matches[0]!;
    expect(m.speakerId).toBe("p1");
    expect(text()).toContain("Your turn to ask!");
    expect(container.querySelector('[role="timer"]')!.getAttribute("aria-label")).toBe("2:00");
    const [done] = buttons("I'm done");
    expect(done!.disabled).toBe(false);
    await click(done!);
    expect(p.act).toHaveBeenCalledWith({
      type: "gc:done",
      payload: { round: 1, matchId: m.id, phaseVersion: m.phaseVersion, turnId: m.turnId },
    });
  });

  it("others see who is asking, no I'm done, and the right help role", async () => {
    await mount(props("p2", "PLAYING"));
    expect(buttons("I'm done")).toHaveLength(0);
    expect(text()).toMatch(/Your team is asking:\s*Ada/);
    expect(text()).toContain("Ask a question");
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(props("p3", "PLAYING"));
    expect(text()).toMatch(/The other team is asking:\s*Ada/);
    expect(text()).toContain("Answer the question");
    expect(text()).toContain("Next:");
  });

  it("keeps the secret hidden until held and only mounts my team's character", async () => {
    await mount(props("p1", "PLAYING"));
    expect(card()).not.toBeNull();
    expect(text()).not.toContain("Thor");
    expect(text()).not.toContain("Spider-Man");
    expect(card().getAttribute("aria-label")).toBe("Hold to see your card");
    await pointer("pointerdown");
    expect(text()).toContain("Thor");
    await pointer("pointerup");
    expect(text()).not.toContain("Thor");
    await pointer("pointerdown");
    await act(async () => window.dispatchEvent(new Event("blur")));
    expect(text()).not.toContain("Thor");
    await pointer("pointerdown");
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(text()).not.toContain("Thor");
    await pointer("pointerdown");
    await pointer("pointercancel");
    expect(text()).not.toContain("Thor");
    // Keyboard hold.
    await act(async () =>
      card().dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })),
    );
    expect(text()).toContain("Thor");
    await act(async () =>
      card().dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true })),
    );
    expect(text()).not.toContain("Thor");
  });

  it("a fresh mount after viewing starts face down", async () => {
    await mount(props("p1", "PLAYING"));
    await pointer("pointerdown");
    expect(text()).toContain("Thor");
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(props("p1", "PLAYING"));
    expect(text()).not.toContain("Thor");
  });

  it("any teammate can guess with the team's guess version; the field clears on success", async () => {
    const p = props("p2", "PLAYING");
    await mount(p);
    const input = container.querySelector<HTMLInputElement>("#gc-guess-input")!;
    await type(input, "  Spider-Man ");
    await submit();
    const m = p.view.matches[0]!;
    expect(p.act).toHaveBeenCalledWith({
      type: "gc:guess",
      payload: {
        round: 1,
        matchId: m.id,
        phaseVersion: m.phaseVersion,
        guessVersion: p.view.privateMatches[0]!.teams[0]!.guessVersion,
        name: "Spider-Man",
      },
    });
    expect(input.value).toBe("");
  });

  it("does not send an empty or punctuation-only guess", async () => {
    const p = props("p2", "PLAYING");
    await mount(p);
    const input = container.querySelector<HTMLInputElement>("#gc-guess-input")!;
    await type(input, "?!");
    await submit();
    expect(p.act).not.toHaveBeenCalled();
    expect(text()).toContain("Type a name first.");
  });

  it("cooldown locks the whole team's guess and shows the countdown", async () => {
    const p = props("p2", "PLAYING", {
      mutate: (s) => {
        s.matches[0]!.teams[0].cooldown = {
          endsAt: NOW + 33_000,
          pausedRemainingMs: null,
          durationMs: 5000,
        };
      },
    });
    await mount(p);
    const guess = buttons("Guess")[0]!;
    expect(guess.disabled).toBe(true);
    expect(text()).toContain("Your team can guess again in");
    expect(container.querySelector(".gc-cooldown [role=timer]")!.getAttribute("aria-label")).toBe(
      "0:03",
    );
  });

  it("paused matches disable done and guesses and explain why", async () => {
    const p = props("p1", "PLAYING", {
      mutate: (s) => {
        const m = s.matches[0]!;
        m.paused = true;
        m.pauseReason = "offline";
        m.timer = { endsAt: null, pausedRemainingMs: 60_000, durationMs: 120_000 };
      },
    });
    await mount(p);
    expect(buttons("I'm done")[0]!.disabled).toBe(true);
    expect(buttons("Guess")[0]!.disabled).toBe(true);
    expect(text()).toContain("a team has nobody online");
    expect(container.querySelector('[role="timer"]')!.getAttribute("aria-label")).toBe(
      "Paused, 1:00",
    );
  });

  it("never renders the opponent's character or any guess text from props", async () => {
    const p = props("p3", "PLAYING");
    await mount(p);
    await pointer("pointerdown");
    expect(text()).toContain("Spider-Man");
    expect(text()).not.toContain("Thor");
  });
});

describe("results", () => {
  it("the winning pair sees both answers and a wait message", async () => {
    await mount(props("p1", "FINISHED"));
    expect(text()).toContain("Your team guessed it!");
    expect(text()).toContain("Thor");
    expect(text()).toContain("Spider-Man");
    expect(text()).toMatch(/Wait for your teacher/);
    expect(buttons(/round/i)).toHaveLength(0);
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(props("p3", "FINISHED"));
    expect(text()).toContain("Team Red guessed your character.");
  });

  it("an ended match says so without a winner", async () => {
    await mount(props("p3", "ENDED"));
    expect(text()).toContain("Match ended by the teacher");
  });
});

describe("English help", () => {
  it("defaults to A1, switches to A2 and remembers it", async () => {
    await mount(props("p1", "PLAYING"));
    const [a1] = buttons("A1");
    expect(a1!.getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain("Can your character fly?");
    await click(buttons("A2")[0]!);
    expect(text()).toContain("What is your character's superpower?");
    expect(localStorage.getItem("cangsplayground:gc-level")).toBe("A2");
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount(props("p1", "PLAYING"));
    expect(buttons("A2")[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("works when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    await mount(props("p1", "PLAYING"));
    expect(buttons("A1")[0]!.getAttribute("aria-pressed")).toBe("true");
    await click(buttons("A2")[0]!);
    expect(buttons("A2")[0]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows Vietnamese meanings", async () => {
    await mount(props("p1", "PLAYING"));
    expect(container.querySelector('[lang="vi"]')!.textContent).not.toBe("");
  });
});

describe("request recovery", () => {
  it.each([
    ["negative ack", async () => false, /didn't work/],
    ["rejected request", async () => Promise.reject(new Error("boom")), /No reply/],
  ])("%s releases pending and shows a retry message", async (_label, impl, message) => {
    const p = props("p1", "PLAYING");
    p.act.mockImplementation(impl as never);
    await mount(p);
    await click(buttons("I'm done")[0]!);
    expect(text()).toMatch(message);
    expect(buttons("I'm done")[0]!.disabled).toBe(false);
  });

  it("no acknowledgement recovers after 5 seconds and is not retried", async () => {
    vi.useFakeTimers();
    const p = props("p2", "PLAYING");
    p.act.mockImplementation(() => new Promise<boolean>(() => {}));
    await mount(p);
    const input = container.querySelector<HTMLInputElement>("#gc-guess-input")!;
    await type(input, "Spider-Man");
    await submit();
    expect(buttons("Guess")[0]!.disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(ACTION_TIMEOUT_MS - 1));
    expect(buttons("Guess")[0]!.disabled).toBe(true);
    await act(async () => vi.advanceTimersByTime(1));
    expect(buttons("Guess")[0]!.disabled).toBe(false);
    expect(text()).toMatch(/No reply/);
    expect(p.act).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("Spider-Man");
  });
});

it("long Vietnamese names render in full", async () => {
  const p = propsFor(player("p6"), "PLAYING", { groups: 4 });
  await mount(p);
  expect(text()).toContain("Nguyễn Thị Phương Thảo Hoàng");
});
