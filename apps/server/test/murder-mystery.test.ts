import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableActions,
  proofSets,
  type Conclusion,
  type MurderShared,
  type MurderView,
} from "@cangsplayground/game-murder-mystery";
import { buildView } from "../src/broadcast.js";
import { registry } from "../src/games/registry.js";
import { Lobby } from "../src/lobby/Lobby.js";
import { TimerService } from "../src/timer/TimerService.js";

const START = 1_000_000;
const SECOND = 1000;
let timers: TimerService;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  timers = new TimerService(() => Date.now());
});
afterEach(() => {
  timers.dispose();
  vi.useRealTimers();
});

function setup(players = 7, groups = 2) {
  const lobby = new Lobby({ code: "MYS234", hostToken: "host-secret-token", seed: 7 });
  lobby.onChange = () => timers.reconcile(lobby);
  const list = Array.from({ length: players }, (_, i) => lobby.join(`Student ${i}`));
  for (const [i, p] of list.entries()) p.sockets.add(`s${i}`);
  lobby.selectGame("murder-mystery");
  lobby.assign("count", groups);
  return { lobby, players: list };
}
const shared = (lobby: Lobby) => lobby.game!.shared as MurderShared;
const guard = (lobby: Lobby) => ({
  caseNumber: shared(lobby).caseNumber,
  phaseVersion: shared(lobby).phaseVersion,
});
const host = (lobby: Lobby, type: string, extra: Record<string, unknown> = {}) =>
  lobby.hostAction({ type, payload: { ...guard(lobby), ...extra } });
const act = (lobby: Lobby, id: string, type: string, extra: Record<string, unknown> = {}) =>
  lobby.action(id, { type, payload: { ...guard(lobby), ...extra } });
const view = (lobby: Lobby, viewer: Parameters<typeof buildView>[1]) =>
  buildView(lobby, viewer).game!.shared as MurderView;
const team = (lobby: Lobby, i = 0) => shared(lobby).teams[i]!;
const leadOf = (lobby: Lobby, i = 0) =>
  team(lobby, i).leadOrder[shared(lobby).investigationRound - 1]!;

/** Every ordered sequence of four offered investigations. */
function routesOf(lobby: Lobby): string[][] {
  const { logic } = shared(lobby).caseData;
  const routes: string[][] = [];
  const walk = (used: string[]) => {
    const known = [
      ...logic.initialCardIds,
      ...used.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
    ];
    if (used.length === 4) return void routes.push(used);
    for (const a of availableActions(logic, used, known)) walk([...used, a.id]);
  };
  walk([]);
  return routes;
}
const known = (lobby: Lobby, route: string[]) => {
  const { logic } = shared(lobby).caseData;
  return [
    ...logic.initialCardIds,
    ...route.flatMap((id) => logic.actions.find((a) => a.id === id)!.resultCardIds),
  ];
};
function conclusion(lobby: Lobby, route: string[]): Conclusion {
  const { logic, reveal } = shared(lobby).caseData;
  const cards = known(lobby, route);
  return {
    ...reveal.answer,
    evidence: {
      suspectId: proofSets(logic, cards, "suspectId")[0]!,
      weaponId: proofSets(logic, cards, "weaponId")[0]!,
      roomId: proofSets(logic, cards, "roomId")[0]!,
    },
  };
}

/** Plays rounds 1-4 for each team along its own route, host advancing, into CONCLUSION. */
function playInvestigation(lobby: Lobby, routes: string[][]) {
  host(lobby, "mm:start");
  host(lobby, "mm:next");
  host(lobby, "mm:next");
  host(lobby, "mm:next");
  for (let round = 1; round <= 4; round++) {
    shared(lobby).teams.forEach((t, i) => {
      act(lobby, t.leadOrder[round - 1]!, "mm:investigate", {
        round,
        actionId: routes[i]![round - 1],
      });
    });
    host(lobby, "mm:next");
  }
}
function submitAll(lobby: Lobby, routes: string[][]) {
  shared(lobby).teams.forEach((t, i) => {
    const submitter = t.leadOrder[3]!;
    act(lobby, submitter, "mm:saveDraft", {
      draftVersion: 0,
      conclusion: conclusion(lobby, routes[i]!),
    });
    act(lobby, submitter, "mm:submit", { draftVersion: 1 });
  });
}

describe("registration and Prepare", () => {
  it("registers the game and rejects teams outside 3-4 players with a clear message", () => {
    expect(registry.get("murder-mystery")?.name).toBe("Murder Mystery");
    // Too small: the shell already refuses to form groups below the game's minimum.
    expect(() => setup(4, 2)).toThrow(/at least 3/);
    // Too big: five players in one group reach Prepare, which refuses with the game's message.
    const big = setup(5, 1);
    expect(() => big.lobby.control("prepare")).toThrow(/3-4/);
    expect(big.lobby.game!.stage).toBe("CONFIGURING");
  });

  it("accepts one team of three and an odd number of teams", () => {
    const one = setup(3, 1);
    one.lobby.control("prepare");
    expect(shared(one.lobby).phase).toBe("READY");
    const three = setup(10, 3);
    three.lobby.control("prepare");
    expect(shared(three.lobby).teams).toHaveLength(3);
  });

  it("shares one case between all teams and starts with no clock running", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    const s = shared(lobby);
    expect(s.teams).toHaveLength(2);
    expect(lobby.sharedDeadlines()).toEqual([]);
    expect(timers.keys().filter((k) => k.includes(":shared:"))).toEqual([]);
    const sizes = s.teams.map((t) => t.members.length).sort();
    expect(sizes).toEqual([3, 4]);
  });
});

describe("the class clock runs on the server", () => {
  it("plays INTRO for 13 s, then every phase, with nobody sending anything", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    expect(shared(lobby).phase).toBe("INTRO");
    vi.advanceTimersByTime(13 * SECOND);
    expect(shared(lobby).phase).toBe("BRIEFING");
    expect(shared(lobby).clock.endsAt).toBe(START + 13 * SECOND + 120 * SECOND);
    vi.advanceTimersByTime((120 + 180) * SECOND);
    expect(shared(lobby).phase).toBe("INVESTIGATION");
    vi.advanceTimersByTime(4 * 180 * SECOND);
    expect(shared(lobby).phase).toBe("CONCLUSION");
    vi.advanceTimersByTime(240 * SECOND);
    expect(shared(lobby).phase).toBe("AWAITING_REVEAL");
    expect(lobby.sharedDeadlines()).toEqual([]);
  });

  it("starts the briefing at once when the intro is skipped", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    vi.advanceTimersByTime(5 * SECOND);
    host(lobby, "mm:next");
    expect(shared(lobby).phase).toBe("BRIEFING");
    expect(shared(lobby).clock.endsAt).toBe(Date.now() + 120 * SECOND);
    vi.advanceTimersByTime(13 * SECOND);
    expect(shared(lobby).phase).toBe("BRIEFING");
  });

  it("freezes the remaining intro time while paused", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    vi.advanceTimersByTime(4 * SECOND);
    host(lobby, "mm:pause");
    vi.advanceTimersByTime(60 * SECOND);
    expect(shared(lobby).phase).toBe("INTRO");
    expect(shared(lobby).clock.remainingMs).toBe(9 * SECOND);
    host(lobby, "mm:resume");
    vi.advanceTimersByTime(8 * SECOND);
    expect(shared(lobby).phase).toBe("INTRO");
    vi.advanceTimersByTime(SECOND);
    expect(shared(lobby).phase).toBe("BRIEFING");
  });

  it("gives a projector that reconnects mid-intro the same clock", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    vi.advanceTimersByTime(6 * SECOND);
    const first = view(lobby, { kind: "projector" });
    const second = view(lobby, { kind: "projector" });
    expect(second.clock).toEqual(first.clock);
    expect(first.clock.endsAt).toBe(START + 13 * SECOND);
    expect(first.intro).not.toBeNull();
    expect(first.briefing).not.toBeNull();
  });

  it("invalidates the old deadline when the host pauses or extends", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    const old = lobby.sharedDeadlines()[0]!;
    host(lobby, "mm:extend", { seconds: 30 });
    const fresh = lobby.sharedDeadlines()[0]!;
    expect(fresh.endsAt).toBe(old.endsAt + 30 * SECOND);
    vi.setSystemTime(old.endsAt);
    expect(lobby.expireSharedDeadline(lobby.game!, old)).toBe(false);
    expect(shared(lobby).phase).toBe("INVESTIGATION");
    expect(shared(lobby).investigationRound).toBe(1);
  });

  it("leaves no stale callback acting on a replacement session after Exit", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    const oldSession = lobby.game!;
    const old = lobby.sharedDeadlines()[0]!;
    lobby.control("exit");
    lobby.selectGame("murder-mystery");
    lobby.control("prepare");
    host(lobby, "mm:start");
    vi.setSystemTime(old.endsAt);
    expect(lobby.expireSharedDeadline(oldSession, old)).toBe(false);
    expect(shared(lobby).phase).toBe("INTRO");
  });
});

describe("a whole class case", () => {
  it("lets two teams solve with different valid routes and reveals both scores together", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    const routes = routesOf(lobby);
    const first = routes[0]!;
    const second = routes.find((r) => [...r].sort().join() !== [...first].sort().join()) ?? first;
    playInvestigation(lobby, [first, second]);
    submitAll(lobby, [first, second]);
    host(lobby, "mm:next");
    expect(shared(lobby).phase).toBe("AWAITING_REVEAL");
    for (const viewer of [
      { kind: "host" as const },
      { kind: "projector" as const },
      { kind: "player" as const, playerId: team(lobby).members[0]! },
    ]) {
      const v = view(lobby, viewer);
      expect(v.results).toBeNull();
      expect(v.reveal).toBeNull();
      expect(v.revealStartedAt).toBeNull();
    }
    host(lobby, "mm:reveal");
    const results = view(lobby, { kind: "projector" }).results!;
    expect(results.map((r) => r.score.total)).toEqual([10, 10]);
    expect(results.map((r) => r.rank)).toEqual([1, 1]);
    const at = view(lobby, { kind: "projector" }).revealStartedAt;
    expect(at).toBe(Date.now());
    for (const t of shared(lobby).teams) {
      expect(view(lobby, { kind: "player", playerId: t.members[0]! }).revealStartedAt).toBe(at);
    }
  });

  it("shows no intro data to any player in any phase", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    const route = routesOf(lobby)[0]!;
    const seen: string[] = [];
    const record = () => {
      for (const t of shared(lobby).teams) {
        for (const id of t.members)
          seen.push(JSON.stringify(view(lobby, { kind: "player", playerId: id }).intro));
      }
    };
    record();
    playInvestigation(lobby, [route, route]);
    record();
    host(lobby, "mm:next");
    host(lobby, "mm:reveal");
    record();
    expect(new Set(seen)).toEqual(new Set(["null"]));
    expect(view(lobby, { kind: "projector" }).intro).not.toBeNull();
  });

  it("keeps a reconnecting card owner's clues and lets the host move an offline lead's turns", () => {
    const { lobby, players } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    const t = team(lobby);
    const owner = t.members.find((m) => Object.values(t.owners).includes(m))!;
    const mineBefore = view(lobby, { kind: "player", playerId: owner }).ownTeam!.myCards.map(
      (c) => c.id,
    );
    const seat = players.find((p) => p.id === owner)!;
    seat.sockets.clear();
    lobby.connectionChanged();
    expect(team(lobby).connected).not.toContain(owner);
    seat.sockets.add("s-again");
    lobby.connectionChanged();
    expect(team(lobby).connected).toContain(owner);
    expect(
      view(lobby, { kind: "player", playerId: owner }).ownTeam!.myCards.map((c) => c.id),
    ).toEqual(mineBefore);

    host(lobby, "mm:next");
    const lead = leadOf(lobby);
    const offline = players.find((p) => p.id === lead)!;
    offline.sockets.clear();
    lobby.connectionChanged();
    const target = team(lobby).connected[0]!;
    host(lobby, "mm:transfer", {
      groupId: team(lobby).groupId,
      fromPlayerId: lead,
      toPlayerId: target,
    });
    expect(leadOf(lobby)).toBe(target);
    const route = routesOf(lobby)[0]!;
    expect(() => act(lobby, lead, "mm:investigate", { round: 1, actionId: route[0] })).toThrow();
    act(lobby, target, "mm:investigate", { round: 1, actionId: route[0] });
    expect(team(lobby).history).toHaveLength(1);
  });

  it("gives a kicked student's same-name rejoin a new id and a public-only view", () => {
    const { lobby, players } = setup();
    lobby.control("prepare");
    host(lobby, "mm:start");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    const leaver = team(lobby).members[1]!;
    const cardsBefore = Object.keys(team(lobby).owners).sort();
    lobby.removePlayer(leaver);
    expect(team(lobby).members).not.toContain(leaver);
    expect(Object.keys(team(lobby).owners).sort()).toEqual(cardsBefore);
    const name = players.find((p) => p.id === leaver)!.name;
    const back = lobby.join(name);
    back.sockets.add("s-new");
    expect(back.id).not.toBe(leaver);
    const v = view(lobby, { kind: "player", playerId: back.id });
    expect(v.ownTeam).toBeNull();
    expect(v.hostDetails).toBeNull();
    expect(() => act(lobby, back.id, "mm:investigate", { round: 1, actionId: "x" })).toThrow();
    expect(view(lobby, { kind: "player", playerId: leaver }).ownTeam).toBeNull();
  });

  it("cannot be altered by a replayed command from the previous case", () => {
    const { lobby } = setup();
    lobby.control("prepare");
    const route = routesOf(lobby)[0]!;
    host(lobby, "mm:start");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    host(lobby, "mm:next");
    const replay = { ...guard(lobby), round: 1, actionId: route[0] };
    const leadId = leadOf(lobby);
    lobby.action(leadId, { type: "mm:investigate", payload: replay });
    host(lobby, "mm:next");
    for (let r = 2; r <= 4; r++) host(lobby, "mm:next");
    host(lobby, "mm:next");
    host(lobby, "mm:reveal");
    host(lobby, "mm:newCase");
    expect(shared(lobby)).toMatchObject({ caseNumber: 2, phase: "READY" });
    const snapshot = JSON.stringify(shared(lobby));
    expect(() => lobby.action(leadId, { type: "mm:investigate", payload: replay })).toThrow();
    expect(JSON.stringify(shared(lobby))).toBe(snapshot);
  });
});
