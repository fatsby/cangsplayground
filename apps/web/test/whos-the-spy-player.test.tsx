// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { GroupGameView, LobbyView } from "@cangsplayground/core";
import whosTheSpy, { type WhosTheSpyGroupView } from "@cangsplayground/game-whos-the-spy";
import views from "@cangsplayground/game-whos-the-spy/views";

function playerView(phase: GroupGameView["phase"], data: Partial<WhosTheSpyGroupView> = {}) {
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
    players: ["Ada", "Bo", "Cy", "Dee", "Eli", "Fay", "Gia"].map((name, i) => ({
      id: `p${i + 1}`,
      name,
      groupId: "g1",
      connected: true,
      away: false,
    })),
    groups: [
      {
        id: "g1",
        index: 0,
        name: "Team Red",
        playerIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
      },
    ],
    me: { playerId: "p1", name: "Ada", groupId: "g1" },
    game: {
      clock: null,
      gameId: whosTheSpy.id,
      name: whosTheSpy.name,
      stage: "ACTIVE",
      config: null,
      publicInfo: { category: "location", turnSeconds: 60 },
      unsupportedControls: whosTheSpy.unsupportedControls,
      groups: [
        {
          groupId: "g1",
          eliminated: [],
          phase,
          round: 1,
          currentSpeakerId: "p2",
          nextSpeakerId: "p3",
          turnOrder: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"],
          turnIndex: 1,
          turnCount: 7,
          timer: { endsAt: 30000, pausedRemainingMs: null, durationMs: 30000 },
          revealed: false,
          data: {
            category: "location",
            role: "civilian",
            topic: null,
            spies: null,
            voted: [],
            myVote: null,
            votes: null,
            voteNumber: 0,
            lastVote: null,
            spiesLeft: 1,
            result: null,
            ...data,
          } satisfies WhosTheSpyGroupView,
        },
      ],
    },
  };
  return {
    lobby,
    session: lobby.game!,
    group: lobby.game!.groups[0]!,
    me: lobby.me!,
    serverNow: () => 0,
  };
}

function screen(props: ReturnType<typeof playerView>) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<views.PlayerScreen {...props} />);
  return root;
}

describe("player vote verdict", () => {
  it.each([false, true])(
    "shows the eliminated viewer their verdict before spectator mode (spy: %s)",
    (wasSpy) => {
      const props = playerView("ROUND_END", {
        role: null,
        lastVote: { out: "p1", wasSpy, tally: { p1: 5, p2: 2 } },
      });
      props.group.eliminated = ["p1"];
      const root = screen(props);
      expect(root.querySelector("h1")?.textContent).toBe("You");
      expect(root.textContent).toContain(wasSpy ? "were a SPY!" : "were NOT the spy");
      expect(root.querySelectorAll("li")).toHaveLength(2);
      expect(root.textContent).toContain("You're out now. Stay and watch.");
      expect(root.textContent!.indexOf("You're out now.")).toBeGreaterThan(
        root.textContent!.indexOf("Ada5"),
      );
      expect(root.textContent).not.toContain("Now speaking");
    },
  );
  it("shows a spectator the actual speaker and turn timer", () => {
    const props = playerView("RUNNING");
    props.group.eliminated = ["p1"];
    const root = screen(props);
    expect(root.textContent).toContain("Now speaking: Bo");
    expect(root.querySelector(".cp-timer")).not.toBeNull();
    expect(root.textContent).not.toContain("Waiting for your teacher");
  });
  it("shows a spectator only a waiting message when nobody is speaking", () => {
    const props = playerView("RUNNING");
    props.group.eliminated = ["p1"];
    props.group.currentSpeakerId = null;
    const root = screen(props);
    expect(root.textContent).toContain("Waiting for your teacher…");
    expect(root.textContent).not.toContain("Now speaking");
    expect(root.querySelector(".cp-timer")).toBeNull();
  });
});

describe("player game result", () => {
  it.each([
    {
      role: "spy",
      winner: "team",
      eliminated: false,
      title: "You lose",
      team: "Team wins!",
      reason: "caught",
      line: "The team found you.",
      outcome: "wts-loss",
    },
    {
      role: "spy",
      winner: "spies",
      eliminated: false,
      title: "You win!",
      team: "Spy wins!",
      reason: "outnumbered",
      line: "The spies outnumber the team.",
      outcome: "wts-win",
    },
    {
      role: "civilian",
      winner: "team",
      eliminated: false,
      title: "You win!",
      team: "Team wins!",
      reason: "caught",
      line: "You found every spy.",
      outcome: "wts-win",
    },
    {
      role: "civilian",
      winner: "team",
      eliminated: true,
      title: "You win!",
      team: "Team wins!",
      reason: "caught",
      line: "You found every spy.",
      outcome: "wts-win",
    },
    {
      role: "civilian",
      winner: "spies",
      eliminated: false,
      title: "You lose",
      team: "Spy wins!",
      reason: "time",
      line: "Time's up. A spy is still in the game.",
      outcome: "wts-loss",
    },
  ] as const)(
    "uses the viewer's outcome: $role / $winner / eliminated $eliminated",
    ({ role, winner, eliminated, title, team, reason, line, outcome }) => {
      const props = playerView("FINISHED", { role, result: { winner, reason } });
      if (eliminated) props.group.eliminated = ["p1"];
      const root = screen(props);
      expect(root.querySelector("h1")?.textContent).toBe(title);
      expect(root.textContent).toContain(team);
      expect(root.textContent).toContain(line);
      expect(root.querySelector(`.${outcome}`)).not.toBeNull();
      if (role === "spy") expect(root.textContent).not.toContain("You found every spy.");
    },
  );
  it.each([true, false])(
    "keeps the decisive vote's verdict when the game ends (spy: %s)",
    (wasSpy) => {
      const root = screen(
        playerView("FINISHED", {
          result: { winner: wasSpy ? "team" : "spies", reason: wasSpy ? "caught" : "outnumbered" },
          lastVote: { out: "p2", wasSpy, tally: { p2: 6, p1: 1 } },
        }),
      );
      expect(root.textContent).toContain(
        `Bo was voted out: ${wasSpy ? "was a SPY!" : "was NOT the spy"}`,
      );
    },
  );
});

it("gives the spy a turn tip without assuming they know the topic", () => {
  const Tip = views.PlayerTurnTip!;
  const html = renderToStaticMarkup(<Tip {...playerView("RUNNING", { role: "spy" })} />);
  expect(html).toContain("Talk about the topic. Don&#x27;t get caught.");
});
it.each(["food", "location"] as const)("keeps the civilian %s tip", (category) => {
  const Tip = views.PlayerTurnTip!;
  const html = renderToStaticMarkup(
    <Tip {...playerView("RUNNING", { role: "civilian", category })} />,
  );
  expect(html).toContain(category === "food" ? "Describe the food." : "Describe the place.");
});
it("shows preparation instructions instead of Now/Next before Start", () => {
  const root = screen(playerView("PREPARED"));
  expect(root.textContent).toContain("Get ready. Hold your card to check it.");
  expect(root.textContent).not.toContain("Now:");
  expect(root.textContent).not.toContain("Next:");
});
it("keeps the purple primary vote action and teal progress together in a sticky footer", () => {
  const root = screen(playerView("VOTING", { voted: ["p2", "p3"] }));
  const footer = root.querySelector(".cp-sticky-action");
  const lock = [...root.querySelectorAll("button")].find(
    (button) => button.textContent === "Lock my vote",
  );
  expect(lock?.classList.contains("cp-button-primary")).toBe(true);
  expect(footer?.contains(lock!)).toBe(true);
  expect(footer?.textContent).toContain("2 of 7 voted");
  const progress = footer?.querySelector('[role="progressbar"]');
  expect(progress?.getAttribute("aria-valuenow")).toBe("2");
  expect(progress?.getAttribute("aria-valuemax")).toBe("7");
  expect(root.querySelector("progress")).toBeNull();
  expect(root.querySelectorAll(".wts-vote-option")).toHaveLength(6);
});
