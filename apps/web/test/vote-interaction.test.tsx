// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import type { GameAction, GroupGameView, LobbyView } from "@cangsplayground/core";
import type { WhosTheSpyGroupView } from "@cangsplayground/game-whos-the-spy";
import views from "@cangsplayground/game-whos-the-spy/views";

it("unlocks the ballot when the server clears myVote after its target leaves", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const data: WhosTheSpyGroupView = {
    category: "location",
    role: "civilian",
    topic: { name: "Airport", hints: [] },
    spies: null,
    voted: [],
    myVote: null,
    votes: null,
    voteNumber: 0,
    lastVote: null,
    spiesLeft: 1,
    result: null,
  };
  const group: GroupGameView = {
    groupId: "g1",
    phase: "VOTING",
    round: 1,
    eliminated: [],
    currentSpeakerId: null,
    nextSpeakerId: null,
    turnOrder: ["a", "b", "c", "d"],
    turnIndex: 8,
    turnCount: 8,
    timer: { endsAt: 30000, pausedRemainingMs: null, durationMs: 30000 },
    revealed: false,
    data,
  };
  const session = {
    gameId: "whos-the-spy",
    name: "Who's the Spy",
    stage: "ACTIVE" as const,
    clock: null,
    config: null,
    publicInfo: { category: "location", turnSeconds: 60 },
    groups: [group],
  };
  const lobby: LobbyView = {
    viewer: { kind: "player", playerId: "a" },
    code: "ABC234",
    status: "open",
    locked: false,
    hostConnected: true,
    createdAt: 0,
    maxPlayers: 60,
    players: ["Ada", "Bo", "Cy", "Dee"].map((name, i) => ({
      id: ["a", "b", "c", "d"][i]!,
      name,
      groupId: "g1",
      connected: true,
      away: false,
    })),
    groups: [{ id: "g1", index: 0, name: "Team Red", playerIds: ["a", "b", "c", "d"] }],
    groupsVersion: 1,
    game: session,
    me: { playerId: "a", name: "Ada", groupId: "g1" },
    catalog: [],
    warnings: [],
    version: 1,
  };
  const actions: GameAction[] = [];
  const gameAct = async (action: GameAction) => {
    actions.push(action);
    return true;
  };
  const button = (text: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;
  const render = async (currentGroup: GroupGameView, currentLobby = lobby) => {
    await act(async () =>
      root.render(
        <views.PlayerScreen
          lobby={currentLobby}
          session={session}
          group={currentGroup}
          me={lobby.me!}
          serverNow={() => 0}
          act={gameAct}
        />,
      ),
    );
  };
  try {
    await render(group);
    await act(async () => button("Bo").click());
    await act(async () => button("Lock my vote").click());
    expect(actions).toEqual([{ type: "vote", payload: { targetId: "b" } }]);
    await render({ ...group, data: { ...data, myVote: "b", voted: ["a"] } });
    expect(button("Vote locked").disabled).toBe(true);
    // Keep the same mounted component, round and voteNumber; only the server ballot changes.
    const afterLeave = {
      ...lobby,
      players: lobby.players.filter((p) => p.id !== "b"),
      groups: [{ ...lobby.groups[0]!, playerIds: ["a", "c", "d"] }],
    };
    await render({ ...group, data: { ...data, myVote: null, voted: [] } }, afterLeave);
    expect(button("Cy").disabled).toBe(false);
    expect(container.textContent).not.toContain("Vote locked");
    expect(button("Lock my vote").disabled).toBe(true);
    await act(async () => button("Cy").click());
    expect(button("Lock my vote").disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
