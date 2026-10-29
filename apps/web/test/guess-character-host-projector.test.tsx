// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import game from "@cangsplayground/game-guess-the-character";
import views from "@cangsplayground/game-guess-the-character/views";
import { catalogEntry, type LobbyView } from "@cangsplayground/core";
import { HostGame } from "../src/components/HostGame";
import { NOW, propsFor, type Phase } from "./guess-character-fixture";

const Host = views.HostSessionPanel!;
const Projector = views.ProjectorScreen!;
const Note = views.HostConfigNote!;
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
const text = () => container.textContent ?? "";
const buttons = (label: string) =>
  [...container.querySelectorAll("button")].filter((b) => b.textContent === label);
async function click(el: Element) {
  await act(async () => (el as HTMLElement).click());
}
async function host(phase: Phase, options: Parameters<typeof propsFor>[2] = {}, busy = false) {
  const p = propsFor({ kind: "host" }, phase, options);
  await act(async () => root.render(<Host {...p} busy={busy} />));
  return p;
}
async function projector(phase: Phase, options: Parameters<typeof propsFor>[2] = {}) {
  const p = propsFor({ kind: "projector" }, phase, options);
  await act(async () => root.render(<Projector {...p} />));
  return p;
}

describe("settings", () => {
  it("defaults to 30/120/5 seconds with the agreed limits", () => {
    const entry = catalogEntry(game);
    expect(entry.defaultConfig).toEqual({ voteSeconds: 30, turnSeconds: 120, cooldownSeconds: 5 });
    expect(entry.configFields.map((f) => [f.key, f.min, f.max, f.step])).toEqual([
      ["voteSeconds", 10, 180, 5],
      ["turnSeconds", 15, 600, 15],
      ["cooldownSeconds", 1, 60, 1],
    ]);
  });

  it("the config note explains even groups and warns about odd or empty groups", async () => {
    const p = propsFor({ kind: "host" }, "READY");
    const lobby: LobbyView = {
      ...p.lobby,
      groups: [...p.lobby.groups, { id: "g3", index: 2, name: "Team Yellow", playerIds: [] }],
    };
    const session = {
      ...p.session,
      stage: "CONFIGURING" as const,
      config: { turnSeconds: 45, cooldownSeconds: 9 },
    };
    await act(async () => root.render(<Note lobby={lobby} session={session} />));
    expect(text()).toMatch(/even number of groups/);
    expect(text()).toMatch(/1 player/);
    expect(text()).toContain("45 s");
    expect(text()).toContain("9 s");
    expect(text()).toContain("You have 3 groups. Make 2 or 4 groups to play.");
    expect(text()).toContain("1 group has no players.");
  });

  it("HostGame shows the draft config in the note while editing", async () => {
    const p = propsFor({ kind: "host" }, "READY");
    const lobby: LobbyView = {
      ...p.lobby,
      catalog: [catalogEntry(game)],
      game: { ...p.session, stage: "CONFIGURING", shared: null, config: game.defaultConfig },
    };
    await act(async () =>
      root.render(
        <HostGame
          view={lobby}
          busy={false}
          serverNow={() => NOW}
          select={() => {}}
          configure={async () => true}
          control={() => {}}
        />,
      ),
    );
    expect(text()).toContain("Category vote time");
    expect(text()).toContain("120 s");
  });
});

describe("host console", () => {
  it("READY offers Start round with the current round", async () => {
    const p = await host("READY");
    expect(text()).toContain("Teams are paired");
    await click(buttons("Start round")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith({ type: "gc:start", payload: { round: 1 } });
  });

  it("shows both characters, speakers and guarded per-match controls", async () => {
    const p = await host("PLAYING", { groups: 4 });
    expect(text()).toContain("Thor");
    expect(text()).toContain("Spider-Man");
    expect(text()).toContain("Hulk");
    expect(text()).toContain("Batman");
    expect(text()).toContain("Nguyễn Thị Phương Thảo Hoàng");
    expect(container.querySelectorAll(".gc-match")).toHaveLength(2);
    const second = container.querySelectorAll(".gc-match")[1]!;
    const skip = [...second.querySelectorAll("button")].find((b) => b.textContent === "Skip turn")!;
    await click(skip);
    const m = p.view.matches[1]!;
    expect(p.hostAct).toHaveBeenCalledWith({
      type: "gc:skip",
      payload: { round: 1, matchId: m.id, phaseVersion: m.phaseVersion, turnId: m.turnId },
    });
    await click(buttons("Pause all")[0]!);
    expect(p.hostAct).toHaveBeenLastCalledWith({
      type: "gc:pauseAll",
      payload: {
        round: 1,
        matches: p.view.matches.map((x) => ({
          round: 1,
          matchId: x.id,
          phaseVersion: x.phaseVersion,
          turnId: x.turnId,
        })),
      },
    });
  });

  it("End match needs a second tap", async () => {
    const p = await host("PLAYING");
    await click(buttons("End match")[0]!);
    expect(p.hostAct).not.toHaveBeenCalled();
    await click(buttons("Tap again to end")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith(expect.objectContaining({ type: "gc:end" }));
  });

  it("paused cards name the reason, show stopped time and block an impossible resume", async () => {
    const p = propsFor({ kind: "host" }, "PLAYING", {
      mutate: (s) => {
        const m = s.matches[0]!;
        m.paused = true;
        m.pauseReason = "offline";
        m.timer = { endsAt: null, pausedRemainingMs: 90_000, durationMs: 120_000 };
      },
    });
    p.lobby.players.find((x) => x.id === "p3")!.connected = false;
    p.lobby.players.find((x) => x.id === "p4")!.connected = false;
    await act(async () => root.render(<Host {...p} />));
    expect(text()).toContain("a team has nobody online");
    expect(container.querySelector('[role="timer"]')!.getAttribute("aria-label")).toBe(
      "Paused, 1:30",
    );
    expect(buttons("Resume")[0]!.disabled).toBe(true);
    expect(buttons("Resume all")[0]!.disabled).toBe(true);
    expect(text()).toContain("Nobody in this team is online.");
  });

  it("disables every control while busy", async () => {
    await host("PLAYING", { groups: 4 }, true);
    const all = [...container.querySelectorAll("button")];
    expect(all.length).toBeGreaterThan(3);
    expect(all.every((b) => b.disabled)).toBe(true);
  });

  it("New round enables only when every match is over", async () => {
    await host("FINISHED", { groups: 4 });
    expect(buttons("New round")).toHaveLength(0);
    await act(async () => root.unmount());
    root = createRoot(container);
    const p = await host("FINISHED", {
      groups: 4,
      mutate: (s) => {
        const m = s.matches[1]!;
        m.phase = "ENDED";
        m.endReason = "host";
      },
    });
    await click(buttons("New round")[0]!);
    expect(p.hostAct).toHaveBeenCalledWith({ type: "gc:newRound", payload: { round: 1 } });
  });

  it("the secrets tab panel shows that group's character", async () => {
    const p = propsFor({ kind: "host" }, "PLAYING");
    const Panel = views.HostGroupPanel!;
    const group = { groupId: "g2" } as never;
    await act(async () => root.render(<Panel {...p} group={group} />));
    expect(text()).toContain("Spider-Man");
    expect(text()).not.toContain("Thor");
  });
});

describe("projector", () => {
  it("shows the public grid without secrets", async () => {
    await projector("PLAYING", { groups: 4 });
    expect(container.querySelectorAll(".gc-pmatch")).toHaveLength(2);
    expect(container.querySelector(".cp-secret-card")).toBeNull();
    for (const name of ["Thor", "Spider-Man", "Hulk", "Batman"]) expect(text()).not.toContain(name);
    expect(text()).toContain("Superheroes");
    expect(text()).toContain("Ada");
    expect(container.querySelectorAll('[role="timer"]')).toHaveLength(2);
  });

  it("a finished match announces the winner but not the answers while another plays", async () => {
    await projector("FINISHED", { groups: 4 });
    expect(text()).toContain("Team Red guessed it!");
    for (const name of ["Thor", "Spider-Man", "Hulk", "Batman"]) expect(text()).not.toContain(name);
  });

  it("follows each match by ID when pairing changes", async () => {
    await projector("CATEGORY_VOTE", {
      groups: 4,
      mutate: (s) => {
        s.matches.reverse();
      },
    });
    const cards = container.querySelectorAll(".gc-pmatch");
    expect(cards[0]!.textContent).toContain("Match 2");
    expect(cards[0]!.textContent).toContain("Team Yellow");
    expect(cards[1]!.textContent).toContain("Team Red");
    expect(text()).toContain("Voting: 0 of 4");
  });
});
