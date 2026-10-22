// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { GameClock, allGroupsFinished, showTurnTimer } from "@cangsplayground/ui";
import { spyLobby } from "./spy-ux-fixture";
const session = spyLobby().game!;
const group = session.groups[0]!;
describe("session clock", () => {
  it("shows the full duration before Start", () => {
    const html = render(<GameClock clock={session.clock!} serverNow={() => 0} />);
    expect(html).toContain("12:00");
    expect(html).not.toContain("lucide-pause");
  });
  it("has a compact mono chip with a pause icon", () => {
    const clock = {
      ...session.clock!,
      timer: { ...session.clock!.timer, pausedRemainingMs: 695000 },
    };
    const html = render(<GameClock clock={clock} serverNow={() => 0} size="compact" />);
    expect(html).toContain("11:35");
    expect(html).toContain("cp-game-clock-compact");
    expect(html).not.toContain("Game time");
    expect(html).toContain("lucide-pause");
  });
  it("shows Game over without a live timer when every group finishes", () => {
    const html = render(
      <GameClock
        clock={session.clock!}
        groups={[{ ...group, phase: "FINISHED" }]}
        serverNow={() => 0}
      />,
    );
    expect(html).toContain("Game over");
    expect(html).not.toContain('role="timer"');
  });
  it("retains the Time’s up result when the clock expired", () => {
    expect(
      render(
        <GameClock
          clock={{ ...session.clock!, done: true }}
          groups={[{ ...group, phase: "FINISHED" }]}
          serverNow={() => 0}
          size="lg"
        />,
      ),
    ).toContain("Time&#x27;s up");
  });
});

it("keeps an empty or partly finished session active", () => {
  expect(allGroupsFinished([])).toBe(false);
  expect(allGroupsFinished([{ phase: "FINISHED" }, { phase: "RUNNING" }])).toBe(false);
});
it("hides only idle end timers and all prepared turn timers", () => {
  expect(showTurnTimer({ ...group, phase: "ROUND_END" })).toBe(false);
  expect(
    showTurnTimer({
      ...group,
      phase: "ROUND_END",
      timer: { ...group.timer, pausedRemainingMs: 1000 },
    }),
  ).toBe(true);
  expect(
    showTurnTimer({ ...group, phase: "RUNNING", timer: { ...group.timer, endsAt: 1000 } }),
  ).toBe(true);
});
it("does not tick an idle clock and clears ticking when its session finishes", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(<GameClock clock={session.clock!} groups={[group]} serverNow={() => 0} />),
    );
    expect(vi.getTimerCount()).toBe(0);
    const clock = { ...session.clock!, timer: { ...session.clock!.timer, endsAt: 720000 } };
    await act(async () =>
      root.render(<GameClock clock={clock} groups={[group]} serverNow={() => 0} />),
    );
    expect(vi.getTimerCount()).toBe(1);
    await act(async () =>
      root.render(
        <GameClock clock={clock} groups={[{ ...group, phase: "FINISHED" }]} serverNow={() => 0} />,
      ),
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(container.textContent).toContain("Game over");
  } finally {
    await act(async () => root.unmount());
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
