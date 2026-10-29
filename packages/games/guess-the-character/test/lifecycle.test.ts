import { describe, expect, it } from "vitest";
import { characterById } from "../src/content.js";
import { controlGuard, guard, playing, setCharacters, start, type Harness } from "./helpers.js";

function wrongGuess(h: Harness, side: 0 | 1) {
  const m = h.match();
  return h.act(m.teams[side].members[0]!, "gc:guess", {
    ...guard(h, m),
    guessVersion: m.teams[side].guessVersion,
    name: "Nobody At All",
  });
}

describe("pause and resume", () => {
  it("keeps exactly the remaining cooldown and turn time through a long pause", () => {
    const h = playing([2, 2]);
    setCharacters(h, 0, "thor", "spider-man");
    wrongGuess(h, 0);
    h.tick(2000);
    const turnLeft = h.match().timer.endsAt! - h.now;
    h.act("host", "gc:pause", controlGuard(h, h.match()));
    const paused = h.match();
    expect(paused.teams[0].cooldown).toEqual({
      endsAt: null,
      pausedRemainingMs: 3000,
      durationMs: 5000,
    });
    expect(paused.timer.pausedRemainingMs).toBe(turnLeft);
    h.tick(60_000);
    h.expireDue();
    expect(h.match().turnId).toBe(paused.turnId);
    // Player actions are locked while paused.
    expect(wrongGuess(h, 1)).toBeNull();
    expect(
      h.act(paused.speakerId!, "gc:done", { ...guard(h, h.match()), turnId: paused.turnId }),
    ).toBeNull();
    h.act("host", "gc:resume", controlGuard(h, h.match()));
    const resumed = h.match();
    expect(resumed.teams[0].cooldown.endsAt).toBe(h.now + 3000);
    expect(resumed.timer.endsAt).toBe(h.now + turnLeft);
    expect(resumed.paused).toBe(false);
  });

  it("an expired cooldown is cleared rather than paused", () => {
    const h = playing([1, 1]);
    setCharacters(h, 0, "thor", "spider-man");
    wrongGuess(h, 0);
    h.tick(6000);
    h.act("host", "gc:pause", controlGuard(h, h.match()));
    expect(h.match().teams[0].cooldown).toEqual({
      endsAt: null,
      pausedRemainingMs: null,
      durationMs: 5000,
    });
  });

  it("stale guards do not pause a newer phase or turn", () => {
    const h = playing([1, 1]);
    const old = controlGuard(h, h.match());
    const m = h.match();
    h.act(m.speakerId!, "gc:done", { ...guard(h, m), turnId: m.turnId });
    expect(h.act("host", "gc:pause", old)).toBeNull();
    expect(h.act("host", "gc:skip", old)).toBeNull();
    expect(h.act("host", "gc:pause", { ...controlGuard(h, h.match()), round: 2 })).toBeNull();
    expect(h.act(m.speakerId!, "gc:pause", controlGuard(h, h.match()))).toBeNull();
  });

  it("skip works only on a matching, running turn", () => {
    const h = playing([1, 1]);
    const m = h.match();
    expect(h.act("host", "gc:skip", controlGuard(h, m))).not.toBeNull();
    expect(h.match().turnId).toBe(m.turnId + 1);
    h.act("host", "gc:pause", controlGuard(h, h.match()));
    expect(h.act("host", "gc:skip", controlGuard(h, h.match()))).toBeNull();
    const voting = start([1, 1]);
    voting.act("host", "gc:start", { round: 1 });
    expect(voting.act("host", "gc:skip", controlGuard(voting, voting.match()))).toBeNull();
  });

  it("pause all / resume all apply only still-matching guards", () => {
    const h = playing([1, 1, 1, 1]);
    const guards = h.shared.matches.map((m) => controlGuard(h, m));
    const m0 = h.match(0);
    h.act(m0.speakerId!, "gc:done", { ...guard(h, m0), turnId: m0.turnId });
    expect(h.act("host", "gc:pauseAll", { round: 1, matches: guards })).not.toBeNull();
    expect(h.match(0).paused).toBe(false);
    expect(h.match(1).paused).toBe(true);
    expect(h.act("host", "gc:pauseAll", { round: 1, matches: [guards[0]] })).toBeNull();
    const all = h.shared.matches.map((m) => controlGuard(h, m));
    expect(h.act("host", "gc:resumeAll", { round: 1, matches: all })).not.toBeNull();
    expect(h.shared.matches.every((m) => !m.paused)).toBe(true);
    expect(h.act("host", "gc:resumeAll", { round: 1, matches: all })).toBeNull();
    expect(h.act("host", "gc:pauseAll", { round: 1, matches: [] })).toBeNull();
  });
});

describe("ending and new rounds", () => {
  it("End match stops the timer with no winner, even while paused", () => {
    const h = playing([1, 1, 1, 1]);
    h.act("host", "gc:pause", controlGuard(h, h.match(1)));
    h.act("host", "gc:end", controlGuard(h, h.match()));
    h.act("host", "gc:end", controlGuard(h, h.match(1)));
    for (const m of h.shared.matches) {
      expect(m.phase).toBe("ENDED");
      expect(m.endReason).toBe("host");
      expect(m.winnerGroupId).toBeNull();
      expect(m.timer.endsAt).toBeNull();
      expect(m.timer.pausedRemainingMs).toBeNull();
    }
    expect(h.deadlines()).toEqual([]);
    expect(h.act("host", "gc:end", controlGuard(h, h.match()))).toBeNull();
  });

  it("End works in READY and voting", () => {
    const h = start([1, 1, 1, 1]);
    expect(h.act("host", "gc:end", controlGuard(h, h.match()))).not.toBeNull();
    // Start still starts the other match.
    expect(h.view({ kind: "host" }).canStart).toBe(true);
    h.act("host", "gc:start", { round: 1 });
    expect(h.match(0).phase).toBe("ENDED");
    expect(h.match(1).phase).toBe("CATEGORY_VOTE");
    expect(h.act("host", "gc:end", controlGuard(h, h.match(1)))).not.toBeNull();
  });

  it("New round rejects while any match is active, then reshuffles and starts voting", () => {
    const h = playing([2, 2, 2, 2]);
    setCharacters(h, 0, "thor", "spider-man");
    wrongGuess(h, 0);
    expect(h.act("host", "gc:newRound", { round: 1 })).toBeNull();
    const m = h.match();
    h.act(m.teams[0].members[0]!, "gc:guess", {
      ...guard(h, m),
      guessVersion: m.teams[0].guessVersion,
      name: "Spider-Man",
    });
    expect(h.match().phase).toBe("PLAYING"); // still cooling down
    h.tick(5000);
    h.act(m.teams[0].members[0]!, "gc:guess", {
      ...guard(h, h.match()),
      guessVersion: h.match().teams[0].guessVersion,
      name: "Spider-Man",
    });
    expect(h.match().phase).toBe("FINISHED");
    expect(h.act("host", "gc:newRound", { round: 1 })).toBeNull();
    h.act("host", "gc:end", controlGuard(h, h.match(1)));
    expect(h.view({ kind: "host" }).canNewRound).toBe(true);
    expect(h.act("host", "gc:newRound", { round: 2 })).toBeNull();
    const oldGuard = guard(h, h.match());
    expect(h.act("host", "gc:newRound", { round: 1 })).not.toBeNull();
    expect(h.shared.round).toBe(2);
    for (const match of h.shared.matches) {
      expect(match.id).toMatch(/^r2m/);
      expect(match.phase).toBe("CATEGORY_VOTE");
      expect(match.timer.endsAt).toBe(h.now + 30_000);
      expect(match.votes).toEqual({});
      expect(match.winnerGroupId).toBeNull();
      for (const t of match.teams) {
        expect(t.characterId).toBeNull();
        expect(t.guessVersion).toBe(0);
        expect(t.cooldown.endsAt).toBeNull();
      }
    }
    // Previous-round actions are stale.
    expect(
      h.act(h.match().teams[0].members[0]!, "gc:vote", { ...oldGuard, categoryId: "superheroes" }),
    ).toBeNull();
    expect(h.act("host", "gc:start", { round: 2 })).toBeNull();
  });
});

describe("departures and connections", () => {
  it("removes an unclosed vote and the turn slot", () => {
    const h = start([2, 2]);
    h.act("host", "gc:start", { round: 1 });
    const m = h.match();
    const leaver = m.teams[0].members[0]!;
    h.act(leaver, "gc:vote", { ...guard(h, m), categoryId: "superheroes" });
    h.leave(leaver);
    expect(h.match().votes).toEqual({});
    expect(h.match().teams[0].members).not.toContain(leaver);
    expect(h.shared.groups.flatMap((g) => g.members)).not.toContain(leaver);
  });

  it("the current speaker leaving advances exactly once", () => {
    const h = playing([2, 2]);
    const m = h.match();
    h.leave(m.speakerId!);
    expect(h.match().turnId).toBe(m.turnId + 1);
    expect(h.match().askingTeam).not.toBe(m.askingTeam);
    expect(h.match().speakerId).not.toBe(m.speakerId);
  });

  it("an emptied team ends only its own match, with no winner", () => {
    const h = playing([1, 2, 2, 2]);
    const index = h.shared.matches.findIndex((mm) => mm.teams.some((t) => t.members.length === 1));
    const solo = h.match(index).teams.find((t) => t.members.length === 1)!;
    h.leave(solo.members[0]!);
    expect(h.match(index)).toMatchObject({
      phase: "ENDED",
      endReason: "empty-group",
      winnerGroupId: null,
    });
    expect(h.match(1 - index).phase).toBe("PLAYING");
    // New round needs every group to have a player.
    h.act("host", "gc:end", controlGuard(h, h.match(1 - index)));
    expect(h.view({ kind: "host" }).canNewRound).toBe(false);
    expect(h.view({ kind: "host" }).newRoundIssue).toMatch(/at least 1 player/);
    expect(h.act("host", "gc:newRound", { round: 1 })).toBeNull();
  });

  it("a disconnected speaker keeps the turn until it expires", () => {
    const h = playing([2, 2]);
    const m = h.match();
    h.setConnected(m.speakerId!, false);
    expect(h.match().speakerId).toBe(m.speakerId);
    expect(h.match().paused).toBe(false);
    h.tick(120_000);
    h.expireDue();
    expect(h.match().turnId).toBe(m.turnId + 1);
  });

  it("vote closing with one side offline assigns secrets, then pauses with a full turn", () => {
    const h = start([1, 1]);
    h.act("host", "gc:start", { round: 1 });
    h.setConnected(h.match().teams[1].members[0]!, false);
    h.tick(30_000);
    h.expireDue();
    const m = h.match();
    expect(m.phase).toBe("PLAYING");
    expect(m.teams.every((t) => t.characterId)).toBe(true);
    expect(m).toMatchObject({ paused: true, pauseReason: "offline", speakerId: null });
    expect(m.timer.pausedRemainingMs).toBe(120_000);
    // Reconnect never auto-resumes.
    h.setConnected(m.teams[1].members[0]!, true);
    expect(h.match().paused).toBe(true);
    expect(h.act("host", "gc:resume", controlGuard(h, h.match()))).not.toBeNull();
    expect(h.match().speakerId).toBe(h.match().teams[h.match().askingTeam].members[0]);
    expect(h.match().timer.endsAt).toBe(h.now + 120_000);
  });

  it("host resume requires someone online in both teams", () => {
    const h = playing([1, 1]);
    h.act("host", "gc:pause", controlGuard(h, h.match()));
    h.setConnected(h.match().teams[0].members[0]!, false);
    expect(h.act("host", "gc:resume", controlGuard(h, h.match()))).toBeNull();
    expect(h.view({ kind: "host" }).matches[0]!.connectedCounts).toEqual([0, 1]);
  });

  it("resume replaces an offline speaker with a connected teammate on a fresh turn", () => {
    const h = playing([2, 2]);
    const m = h.match();
    h.act("host", "gc:pause", controlGuard(h, m));
    h.setConnected(m.speakerId!, false);
    h.act("host", "gc:resume", controlGuard(h, h.match()));
    const r = h.match();
    expect(r.speakerId).not.toBe(m.speakerId);
    expect(r.teams[m.askingTeam].members).toContain(r.speakerId);
    expect(r.turnId).toBe(m.turnId + 1);
    expect(r.timer.endsAt).toBe(h.now + 120_000);
  });

  it("a paused speaker leaving opens a paused slot that resume fills", () => {
    const h = playing([2, 2]);
    const m = h.match();
    h.act("host", "gc:pause", controlGuard(h, m));
    h.leave(m.speakerId!);
    expect(h.match()).toMatchObject({ paused: true, speakerId: null, turnId: m.turnId + 1 });
    h.act("host", "gc:resume", controlGuard(h, h.match()));
    expect(h.match().teams[m.askingTeam].members).toContain(h.match().speakerId);
  });

  it("a removed student who rejoins with a new ID stays a spectator; reconnects keep rights", () => {
    const h = start([2, 2]);
    h.act("host", "gc:start", { round: 1 });
    const m = h.match();
    const [stay, leaver] = m.teams[0].members;
    h.leave(leaver!);
    h.join("new-id", m.teams[0].groupId);
    expect(
      h.act("new-id", "gc:vote", { ...guard(h, h.match()), categoryId: "superheroes" }),
    ).toBeNull();
    h.setConnected(stay!, false);
    h.setConnected(stay!, true);
    expect(
      h.act(stay!, "gc:vote", { ...guard(h, h.match()), categoryId: "superheroes" }),
    ).not.toBeNull();
    // A finished match still reveals answers to its remaining players only.
    h.tick(30_000);
    h.expireDue();
    const p = h.match();
    h.act(stay!, "gc:guess", {
      ...guard(h, p),
      guessVersion: p.teams[0].guessVersion,
      name: characterById(p.teams[1].characterId!).name,
    });
    expect(h.view({ kind: "player", playerId: "new-id" }).privateMatches).toEqual([]);
  });
});
