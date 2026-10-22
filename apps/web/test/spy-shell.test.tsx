import { describe, expect, it } from "vitest";
import { renderToStaticMarkup as render } from "react-dom/server";
import { GroupCard } from "@cangsplayground/ui";
import views from "@cangsplayground/game-whos-the-spy/views";
import { HostGame } from "../src/components/HostGame";
import { ConfigForm } from "../src/components/ConfigForm";
import { spyLobby } from "./spy-ux-fixture";

const lobby = spyLobby();
const session = lobby.game!;
const group = session.groups[0]!;
const summary = lobby.groups[0]!;
const ProjectorExtra = views.ProjectorGroupCard!;
const props = { lobby, session, group, serverNow: () => 0 };
const host = (view = lobby) =>
  render(
    <HostGame
      view={view}
      busy={false}
      serverNow={() => 0}
      select={() => {}}
      configure={async () => true}
      control={() => {}}
    />,
  );

describe("public team cards", () => {
  it.each(["PREPARED", "ROUND_END", "FINISHED"] as const)(
    "hides dead turn timers in %s",
    (phase) => {
      const html = render(
        <GroupCard
          group={summary}
          players={lobby.players}
          game={{ ...group, phase }}
          serverNow={() => 0}
        />,
      );
      expect(html).not.toContain('role="timer"');
      expect(html).not.toContain("Next:");
      if (phase === "PREPARED") expect(html).toContain("Get ready");
      if (phase === "FINISHED") expect(html).toContain("Done");
    },
  );
  it("labels member counts and accepts round/status/member hooks", () => {
    const html = render(
      <GroupCard
        group={summary}
        players={lobby.players}
        game={group}
        serverNow={() => 0}
        roundLabel="Round 2 of 2"
        status={<span>Voting 1/4</span>}
        renderMemberMark={(id) => (id === "p0" ? "✓" : null)}
      />,
    );
    expect(html).toContain("4 players");
    expect(html).toContain("Round 2 of 2");
    expect(html).toContain("Voting 1/4");
    expect(html).toContain("✓");
  });
  it("renders voting marks only beside voters during VOTING", () => {
    const Mark = views.ProjectorMemberMark!;
    expect(Mark).toBeTypeOf("function");
    expect(
      render(<Mark {...props} group={{ ...group, phase: "VOTING" }} playerId="p0" />),
    ).toContain("✓");
    expect(render(<Mark {...props} playerId="p0" />)).toBe("");
    expect(render(<Mark {...props} group={{ ...group, phase: "VOTING" }} playerId="p1" />)).toBe(
      "",
    );
  });
  it("shows a whole-class pause in the projector card header", () => {
    const Status = views.ProjectorGroupStatus!;
    const pausedSession = {
      ...session,
      clock: { ...session.clock!, timer: { ...session.clock!.timer, pausedRemainingMs: 1000 } },
    };
    expect(render(<Status {...props} session={pausedSession} />)).toContain("Paused");
  });
  it("keeps voting progress out of the extra name grid", () => {
    const html = render(<ProjectorExtra {...props} group={{ ...group, phase: "VOTING" }} />);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Voting");
  });
  it("shows a large finished result with no secrets", () => {
    const html = render(
      <ProjectorExtra
        {...props}
        group={{
          ...group,
          phase: "FINISHED",
          data: { ...(group.data as object), result: { winner: "team", reason: "caught" } },
        }}
      />,
    );
    expect(html).toContain("wts-projector-result");
    expect(html).toContain("Team wins!");
    expect(html).not.toContain("Airport");
    expect(html).not.toContain("p2");
  });
});

describe("spy speaking round labels", () => {
  it("counts active speaking rounds with a safe minimum", () => {
    expect(views.roundLabel?.(group, summary)).toBe("Round 2 of 2");
    expect(views.roundLabel?.({ ...group, turnIndex: 99 }, summary)).toBe("Round 2 of 2");
    expect(
      views.roundLabel?.({ ...group, eliminated: ["p3"], turnCount: 6, turnIndex: 3 }, summary),
    ).toBe("Round 2 of 2");
    expect(
      views.roundLabel?.({ ...group, turnCount: 0, turnIndex: 0 }, { ...summary, playerIds: [] }),
    ).toBe("Round 1 of 1");
  });
  it.each([
    ["VOTING", "Voting"],
    ["ROUND_END", "Vote result"],
    ["FINISHED", "Game over"],
  ] as const)("labels %s", (phase, label) => {
    expect(views.roundLabel?.({ ...group, phase }, summary)).toBe(label);
  });
});

describe("host monitoring", () => {
  it("renders detailed statuses with no secret data", () => {
    const Status = views.HostGroupStatus!;
    expect(Status).toBeTypeOf("function");
    for (const [phase, text] of [
      ["RUNNING", "Speaking · Ada"],
      ["VOTING", "Voting 1/4"],
      ["ROUND_END", "Waiting for Continue"],
      ["PAUSED", "Paused"],
    ] as const) {
      const html = render(<Status {...props} group={{ ...group, phase }} />);
      expect(html).toContain(text);
      expect(html).not.toContain("Airport");
      expect(html).not.toContain("p2");
    }
  });
  it("shows a whole-class pause even when a group is voting", () => {
    const Status = views.HostGroupStatus!;
    const pausedSession = {
      ...session,
      clock: { ...session.clock!, timer: { ...session.clock!.timer, pausedRemainingMs: 1000 } },
    };
    expect(
      render(<Status {...props} session={pausedSession} group={{ ...group, phase: "VOTING" }} />),
    ).toContain("Paused");
  });
  it("collapses active settings and shows round labels", () => {
    const html = host();
    expect(html).toContain("<summary>Game settings</summary>");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Round 2 of 2");
  });
  it("has no duplicate main action inside the per-team grid", () => {
    expect(host().match(/>Pause<\/button>/g)).toHaveLength(2); // All groups + one team primary
  });
  it("shows Finished and no group controls when all teams finish", () => {
    const view = spyLobby("FINISHED");
    const html = host(view);
    expect(html).toContain("Finished");
    expect(html).not.toContain("host-control-grid");
    expect(html).not.toContain("Start round");
    expect(html).not.toContain("Now:");
  });
  it("has no Now label or dead timer before Start", () => {
    const html = host(spyLobby("PREPARED"));
    expect(html).not.toContain("Now:");
    expect(html).not.toContain("0:00");
  });
});

describe("config presentation", () => {
  it("renders topic/category radios and bounded steppers", () => {
    const entry = lobby.catalog[0]!;
    const html = render(
      <ConfigForm
        fields={entry.configFields}
        defaults={entry.defaultConfig}
        config={{}}
        onSave={async () => true}
      />,
    );
    expect(html).toContain('type="radio"');
    expect(html).not.toContain("<select");
    expect(html).toContain('aria-label="Decrease Spies per group"');
    expect(html).toContain('aria-label="Increase Spies per group"');
    expect(html).toContain('role="spinbutton"');
  });
  it("reports the smallest team spy limit and errors on invalid config", () => {
    const Note = views.HostConfigNote!;
    expect(Note).toBeTypeOf("function");
    const html = render(<Note lobby={lobby} session={{ ...session, config: { spies: 2 } }} />);
    expect(html).toContain("Your smallest team has 4 players: up to 1 spy.");
    expect(html).toContain("cp-error");
  });
});
