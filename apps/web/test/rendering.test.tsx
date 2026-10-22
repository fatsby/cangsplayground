import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SecretCard, HostSecretRow } from "@cangsplayground/ui";
import { ConfigForm } from "../src/components/ConfigForm";
import type { ConfigField, GameModule, GroupGameView, LobbyView } from "@cangsplayground/core";
import { freeTalk } from "@cangsplayground/game-free-talk";
import { secretWord } from "@cangsplayground/game-secret-word";
import whosTheSpy, { type WhosTheSpyGroupView } from "@cangsplayground/game-whos-the-spy";
import whosTheSpyViews, { SecretFace } from "@cangsplayground/game-whos-the-spy/views";
import { HostGame } from "../src/components/HostGame";

function hostView(module: GameModule, phase: GroupGameView["phase"]): LobbyView {
  return {
    viewer: { kind: "host" },
    code: "ABC234",
    status: "open",
    locked: false,
    hostConnected: true,
    createdAt: 0,
    maxPlayers: 60,
    players: [],
    groups: [{ id: "g1", index: 0, name: "Team Red", playerIds: ["p1", "p2", "p3"] }],
    groupsVersion: 1,
    catalog: [],
    me: null,
    warnings: [],
    version: 1,
    game: {
      clock: null,
      gameId: module.id,
      name: module.name,
      stage: "ACTIVE",
      config: null,
      publicInfo: null,
      unsupportedControls: module.unsupportedControls,
      groups: [
        {
          groupId: "g1",
          eliminated: [],
          phase,
          round: 1,
          currentSpeakerId: "p1",
          nextSpeakerId: "p2",
          turnOrder: ["p1", "p2", "p3"],
          turnIndex: 0,
          turnCount: 3,
          timer: { endsAt: null, pausedRemainingMs: null, durationMs: 60000 },
          revealed: false,
          data: null,
        },
      ],
    },
  };
}

describe("host game controls", () => {
  it.each(["RUNNING", "ROUND_END"] as const)(
    "hides Free Talk reveal in %s for all and individual groups",
    (phase) => {
      const html = renderToStaticMarkup(
        <HostGame
          view={hostView(freeTalk, phase)}
          busy={false}
          serverNow={() => 0}
          select={() => {}}
          configure={async () => true}
          control={() => {}}
        />,
      );
      expect(html).not.toContain(">Reveal</button>");
      expect(html.match(/>Skip turn<\/button>/g)).toHaveLength(2);
      expect(html.match(/>\+30s<\/button>/g)).toHaveLength(2);
    },
  );
  it("keeps Secret Word reveal visible but disabled before the round ends", () => {
    const html = renderToStaticMarkup(
      <HostGame
        view={hostView(secretWord, "RUNNING")}
        busy={false}
        serverNow={() => 0}
        select={() => {}}
        configure={async () => true}
        control={() => {}}
      />,
    );
    expect(html.match(/<button[^>]*disabled=""[^>]*>Reveal<\/button>/g)).toHaveLength(2);
  });
});

describe("catalog config form rendering", () => {
  it("renders all field kinds with accessible labels and catalog bounds/options", () => {
    const fields: ConfigField[] = [
      { key: "time", label: "Turn time", kind: "number", min: 15, max: 300, step: 5, unit: "sec" },
      { key: "name", label: "Title", kind: "text" },
      { key: "prompt", label: "Question", kind: "textarea" },
      { key: "hints", label: "Show hints", kind: "boolean" },
      {
        key: "level",
        label: "Level",
        kind: "select",
        options: [
          { value: "a2", label: "Easy" },
          { value: "b1", label: "Medium" },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <ConfigForm
        fields={fields}
        defaults={{ time: 60, name: "Free Talk", prompt: "Speak!", hints: false, level: "b1" }}
        config={{}}
        onSave={async () => true}
      />,
    );
    expect(html).toContain("Turn time (sec)");
    expect(html).toContain('min="15"');
    expect(html).toContain('max="300"');
    expect(html).toContain('step="5"');
    expect(html).toContain('type="text"');
    expect(html).toContain("<textarea");
    expect(html).toContain("Speak!");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("<select");
    expect(html).toContain('<option value="b1" selected="">Medium</option>');
  });
});
describe("hidden secrets", () => {
  it("never mounts player secret content before a hold", () => {
    const html = renderToStaticMarkup(
      <SecretCard>
        <span>PRIVATE WORD</span>
      </SecretCard>,
    );
    expect(html).toContain("Hold to see your card");
    expect(html).not.toContain("PRIVATE WORD");
  });
  it("never mounts host details before a hold or explicit reveal", () => {
    expect(
      renderToStaticMarkup(<HostSecretRow teamIndex={0}>SECRET HOST DATA</HostSecretRow>),
    ).not.toContain("SECRET HOST DATA");
    expect(
      renderToStaticMarkup(
        <HostSecretRow teamIndex={0} revealed>
          SECRET HOST DATA
        </HostSecretRow>,
      ),
    ).toContain("SECRET HOST DATA");
  });
});

function spyView(phase: GroupGameView["phase"], data: Partial<WhosTheSpyGroupView> = {}) {
  const lobby = hostView(whosTheSpy, phase);
  lobby.players = ["Ada", "Bo", "Cy"].map((name, i) => ({
    id: `p${i + 1}`,
    name,
    groupId: "g1",
    connected: true,
    away: false,
  }));
  lobby.me = { playerId: "p1", name: "Ada", groupId: "g1" };
  lobby.viewer = { kind: "player", playerId: "p1" };
  const session = lobby.game!,
    group = session.groups[0]!;
  session.publicInfo = { category: "location", turnSeconds: 60 };
  session.voteDurationMs = 30000;
  group.timer = { endsAt: 30000, pausedRemainingMs: null, durationMs: 30000 };
  group.data = {
    category: "location",
    role: "spy",
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
  } satisfies WhosTheSpyGroupView;
  return { lobby, session, group, me: lobby.me, serverNow: () => 0 };
}
it("spy PlayerScreen shows role and category after hold, no topic", () => {
  const props = spyView("RUNNING");
  const html = renderToStaticMarkup(<whosTheSpyViews.PlayerScreen {...props} />);
  expect(html).toContain("Hold to see your card");
  expect(html).not.toContain("You are the SPY");
  const face = renderToStaticMarkup(<SecretFace data={props.group.data as WhosTheSpyGroupView} />);
  expect(face).toContain("You are the SPY");
  expect(face).toContain("Category: Location");
  expect(face).not.toContain("Airport");
});
it("vote screen excludes me and locks", () => {
  const html = renderToStaticMarkup(
    <whosTheSpyViews.PlayerScreen {...spyView("VOTING", { myVote: "p2", voted: ["p1"] })} />,
  );
  expect(html).toContain("Bo");
  expect(html).toContain("Cy");
  expect(html).not.toContain(">Ada<");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Vote locked<\/button>/);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("1 of 3 voted");
  expect(html).toContain("0:30");
});
it("result screen for spies by time", () => {
  const html = renderToStaticMarkup(
    <whosTheSpyViews.PlayerScreen
      {...spyView("FINISHED", {
        result: { winner: "spies", reason: "time" },
        topic: { name: "Airport", hints: [] },
        spies: ["p2"],
      })}
    />,
  );
  expect(html).toContain("Spy wins!");
  expect(html).toContain("Time&#x27;s up. A spy is still in the game.");
  expect(html).toContain("The topic was");
  expect(html).toContain("Airport");
  expect(html).toContain("Spy: Bo");
});
it("controlLabels rename and hide host buttons", () => {
  const props = spyView("ROUND_END");
  const html = renderToStaticMarkup(
    <HostGame
      view={props.lobby}
      busy={false}
      serverNow={() => 0}
      select={() => {}}
      configure={async () => true}
      control={() => {}}
    />,
  );
  expect(html).toContain("Vote now");
  expect(html).toContain("Continue");
  expect(html).not.toContain(">Reveal</button>");
});
it("eliminated players can watch but have no secret card or voting controls", () => {
  const props = spyView("VOTING");
  props.group.eliminated = ["p1"];
  const html = renderToStaticMarkup(<whosTheSpyViews.PlayerScreen {...props} />);
  expect(html).toContain("You&#x27;re out");
  expect(html).toContain("No talking, no voting.");
  expect(html).not.toContain("Hold to see");
  expect(html).not.toContain("Lock my vote");
});
it("vote result explains ties and waits for the teacher", () => {
  const html = renderToStaticMarkup(
    <whosTheSpyViews.PlayerScreen
      {...spyView("ROUND_END", { lastVote: { out: null, wasSpy: false, tally: { p1: 1, p2: 1 } } })}
    />,
  );
  expect(html).toContain("No one was voted out");
  expect(html).toContain("It&#x27;s a tie.");
  expect(html).toContain("Wait for your teacher…");
});
