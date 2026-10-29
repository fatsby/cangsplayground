import { describe, expect, it } from "vitest";
import { categories } from "../src/content.js";
import { validateGroups } from "../src/round.js";
import { guessTheCharacter as game } from "../src/logic.js";
import { configSchema } from "../src/types.js";
import {
  controlGuard,
  groupsOf,
  guard,
  playing,
  setOrder,
  start,
  type Harness,
} from "./helpers.js";

const sorted = (ids: string[]) => [...ids].sort();

/** Arrange fixed orders while voting, then close the vote. */
function ordered(sizes: number[], options = {}) {
  const h = start(sizes, options);
  h.act("host", "gc:start", { round: 1 });
  const m = h.match();
  const small = m.teams[0].members.length <= m.teams[1].members.length ? 0 : 1;
  setOrder(h, 0, [sorted(m.teams[0].members), sorted(m.teams[1].members)], small);
  h.tick(h.config.voteSeconds * 1000);
  h.expireDue();
  return h;
}
function speakers(h: Harness, turns: number) {
  const out: string[] = [];
  for (let i = 0; i < turns; i++) {
    const m = h.match();
    out.push(m.speakerId!);
    expect(h.act(m.speakerId!, "gc:done", { ...guard(h, m), turnId: m.turnId })).not.toBeNull();
  }
  return out;
}

describe("groups and pairing", () => {
  it("accepts even group counts with at least one member each", () => {
    expect(validateGroups(groupsOf([1, 1]))).toBeNull();
    expect(validateGroups(groupsOf([1, 2, 3, 4]))).toBeNull();
    expect(validateGroups(groupsOf([1, 1, 1]))).toMatch(/even number of groups.*Make 2 or 4/);
    expect(validateGroups(groupsOf([2]))).toMatch(/at least 2 groups/);
    expect(validateGroups(groupsOf([2, 0]))).toMatch(/at least 1 player/);
  });

  it("module validateGroups adapts lobby group summaries", () => {
    const summaries = groupsOf([1, 1, 1]).map((g, index) => ({
      id: g.groupId,
      index,
      name: g.groupId,
      playerIds: g.playerIds,
    }));
    expect(game.validateGroups!({ config: game.defaultConfig, groups: summaries })).toMatch(/even/);
  });

  it("pairs every group exactly once into READY matches with no timers", () => {
    const h = start([1, 2, 3, 4]);
    expect(h.shared.matches).toHaveLength(2);
    const paired = h.shared.matches.flatMap((m) => m.teams.map((t) => t.groupId));
    expect(sorted(paired)).toEqual(["g1", "g2", "g3", "g4"]);
    for (const m of h.shared.matches) {
      expect(m.phase).toBe("READY");
      expect(m.timer.endsAt).toBeNull();
      for (const t of m.teams) {
        const size = Number(t.groupId.slice(1));
        expect(t.members).toHaveLength(size);
      }
    }
    expect(h.deadlines()).toEqual([]);
    expect(h.shared.matches.map((m) => m.id)).toEqual(["r1m1", "r1m2"]);
  });

  it("works for one versus one", () => {
    const h = playing([1, 1]);
    expect(h.match().phase).toBe("PLAYING");
    expect(h.match().speakerId).not.toBeNull();
  });
});

describe("category vote", () => {
  it("starts every match voting with its own 30 s deadline", () => {
    const h = start([2, 2, 2, 2]);
    expect(h.act("g1p1", "gc:start", { round: 1 })).toBeNull();
    expect(h.act("host", "gc:start", { round: 2 })).toBeNull();
    h.act("host", "gc:start", { round: 1 });
    for (const m of h.shared.matches) {
      expect(m.phase).toBe("CATEGORY_VOTE");
      expect(m.timer).toEqual({ endsAt: 31_000, pausedRemainingMs: null, durationMs: 30_000 });
    }
    expect(h.deadlines()).toHaveLength(2);
    expect(h.act("host", "gc:start", { round: 1 })).toBeNull();
  });

  it("counts an edited vote once and closes only at the deadline", () => {
    const h = start([2, 1]);
    h.act("host", "gc:start", { round: 1 });
    const m = h.match();
    const [a, b] = m.teams[0].members.length === 2 ? m.teams[0].members : m.teams[1].members;
    const c = (m.teams[0].members.length === 1 ? m.teams[0] : m.teams[1]).members[0]!;
    h.act(a!, "gc:vote", { ...guard(h, m), categoryId: "superheroes" });
    h.act(a!, "gc:vote", { ...guard(h, m), categoryId: "fairy-tales" });
    h.act(b!, "gc:vote", { ...guard(h, m), categoryId: "fairy-tales" });
    h.act(c, "gc:vote", { ...guard(h, m), categoryId: "superheroes" });
    expect(h.match().votes).toEqual({
      [a!]: "fairy-tales",
      [b!]: "fairy-tales",
      [c]: "superheroes",
    });
    expect(h.view({ kind: "host" }).matches[0]!.votedCount).toBe(3);
    h.tick(29_999);
    h.expireDue();
    expect(h.match().phase).toBe("CATEGORY_VOTE");
    h.tick(1);
    h.expireDue();
    expect(h.match().phase).toBe("PLAYING");
    expect(h.match().categoryId).toBe("fairy-tales");
  });

  it("rejects bad votes", () => {
    const h = start([1, 1, 1, 1]);
    h.act("host", "gc:start", { round: 1 });
    const [m1, m2] = h.shared.matches;
    const outsider = m2!.teams[0].members[0]!;
    const member = m1!.teams[0].members[0]!;
    expect(h.act(outsider, "gc:vote", { ...guard(h, m1!), categoryId: "superheroes" })).toBeNull();
    expect(h.act(member, "gc:vote", { ...guard(h, m1!), categoryId: "nope" })).toBeNull();
    expect(
      h.act(member, "gc:vote", { ...guard(h, m1!), phaseVersion: 0, categoryId: "superheroes" }),
    ).toBeNull();
    expect(
      h.act(member, "gc:vote", { ...guard(h, m1!), round: 2, categoryId: "superheroes" }),
    ).toBeNull();
    expect(h.act("host", "gc:vote", { ...guard(h, m1!), categoryId: "superheroes" })).toBeNull();
    expect(h.act(member, "gc:vote", { categoryId: "superheroes" })).toBeNull();
  });

  it("rejects a vote at the exact deadline after closing the vote", () => {
    const h = start([1, 1]);
    h.act("host", "gc:start", { round: 1 });
    const m = h.match();
    h.tick(30_000);
    expect(
      h.act(m.teams[0].members[0]!, "gc:vote", { ...guard(h, m), categoryId: "superheroes" }),
    ).toBeNull();
    expect(h.match().phase).toBe("PLAYING");
  });

  it("chooses only among tied leaders", () => {
    const counts = new Map<string, number>();
    for (let seed = 1; seed <= 40; seed++) {
      const h = start([1, 1], {}, seed);
      h.act("host", "gc:start", { round: 1 });
      const m = h.match();
      h.act(m.teams[0].members[0]!, "gc:vote", { ...guard(h, m), categoryId: "anime-manga" });
      h.act(m.teams[1].members[0]!, "gc:vote", { ...guard(h, m), categoryId: "famous-villains" });
      h.tick(30_000);
      h.expireDue();
      const id = h.match().categoryId!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(sorted([...counts.keys()])).toEqual(["anime-manga", "famous-villains"]);
  });

  it("chooses from every category when nobody votes, with two different characters", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const h = playing([1, 1], {}, seed);
      const m = h.match();
      seen.add(m.categoryId!);
      const pool = categories().find((c) => c.id === m.categoryId)!.characterIds;
      expect(pool).toContain(m.teams[0].characterId);
      expect(pool).toContain(m.teams[1].characterId);
      expect(m.teams[0].characterId).not.toBe(m.teams[1].characterId);
    }
    expect(seen.size).toBe(9);
  });

  it("pauses voting and resumes with the remaining time", () => {
    const h = start([1, 1]);
    h.act("host", "gc:start", { round: 1 });
    h.tick(10_000);
    h.act("host", "gc:pause", controlGuard(h, h.match()));
    expect(h.match().timer).toEqual({
      endsAt: null,
      pausedRemainingMs: 20_000,
      durationMs: 30_000,
    });
    expect(h.deadlines()).toEqual([]);
    const m = h.match();
    expect(
      h.act(m.teams[0].members[0]!, "gc:vote", { ...guard(h, m), categoryId: "superheroes" }),
    ).toBeNull();
    h.tick(60_000);
    h.act("host", "gc:resume", controlGuard(h, h.match()));
    expect(h.match().timer.endsAt).toBe(h.now + 20_000);
  });
});

describe("speaking turns", () => {
  it("gives the first turn a full 120 s from the vote close", () => {
    const h = playing([2, 2]);
    const m = h.match();
    expect(m.timer.durationMs).toBe(120_000);
    expect(m.timer.endsAt).toBe(h.now + 120_000);
    const custom = playing([2, 2], { turnSeconds: 15, voteSeconds: 10 });
    expect(custom.match().timer).toEqual({
      endsAt: 11_000 + 15_000,
      pausedRemainingMs: null,
      durationMs: 15_000,
    });
  });

  it("alternates teams and rotates members: A, B, C, D", () => {
    const h = ordered([2, 2]);
    const m = h.match();
    const [A, C] = m.teams[m.askingTeam].members;
    const [B, D] = m.teams[m.askingTeam === 0 ? 1 : 0].members;
    expect(speakers(h, 5)).toEqual([A, B, C, D, A]);
  });

  it("keeps strict alternation for one versus three: A, B, A, C, A, D", () => {
    const h = ordered([1, 3]);
    const m = h.match();
    const [A] = m.teams[m.askingTeam].members;
    const [B, C, D] = m.teams[m.askingTeam === 0 ? 1 : 0].members;
    expect(speakers(h, 6)).toEqual([A, B, A, C, A, D]);
  });

  it("only the current questioner can end the turn, with the current guards", () => {
    const h = playing([2, 2]);
    const m = h.match();
    const other = [...m.teams[0].members, ...m.teams[1].members].find((id) => id !== m.speakerId)!;
    const done = { ...guard(h, m), turnId: m.turnId };
    expect(h.act(other, "gc:done", done)).toBeNull();
    expect(h.act("host", "gc:done", done)).toBeNull();
    expect(h.act(m.speakerId!, "gc:done", { ...done, turnId: m.turnId + 1 })).toBeNull();
    expect(h.act(m.speakerId!, "gc:done", { ...done, matchId: "r1m9" })).toBeNull();
    expect(h.act(m.speakerId!, "gc:done", { ...done, round: 2 })).toBeNull();
    expect(h.act(m.speakerId!, "gc:done", { ...done, phaseVersion: 0 })).toBeNull();
    expect(h.match().turnId).toBe(m.turnId);
    expect(h.act(m.speakerId!, "gc:done", done)).not.toBeNull();
    expect(h.match().turnId).toBe(m.turnId + 1);
  });

  it("a timeout followed by the old done advances once and restarts the clock from now", () => {
    const h = playing([2, 2, 1, 1]);
    const [m, other] = h.shared.matches;
    const otherBefore = structuredClone(other);
    h.tick(120_000);
    expect(h.act(m!.speakerId!, "gc:done", { ...guard(h, m!), turnId: m!.turnId })).toBeNull();
    const after = h.match();
    expect(after.turnId).toBe(m!.turnId + 1);
    expect(after.timer.endsAt).toBe(h.now + 120_000);
    expect(after.askingTeam).not.toBe(m!.askingTeam);
    // The other pair also timed out, on its own clock, exactly once.
    expect(h.match(1).turnId).toBe(otherBefore!.turnId + 1);
  });

  it("ignores stale deadlines", () => {
    const h = playing([1, 1]);
    const stale = h.deadlines()[0]!;
    const m = h.match();
    h.act(m.speakerId!, "gc:done", { ...guard(h, m), turnId: m.turnId });
    h.tick(120_000);
    expect(
      game.onSharedDeadline!({
        config: h.config,
        shared: h.shared,
        roster: h.roster,
        rng: h.rng,
        now: h.now,
        deadline: stale,
      }),
    ).toBeNull();
    // Early: the current deadline is not yet due one ms before.
    const current = h.deadlines()[0]!;
    expect(
      game.onSharedDeadline!({
        config: h.config,
        shared: h.shared,
        roster: h.roster,
        rng: h.rng,
        now: current.endsAt - 1,
        deadline: current,
      }),
    ).toBeNull();
  });

  it("deadline keys encode round, match, phase, version and turn", () => {
    const h = playing([1, 1]);
    const m = h.match();
    expect(h.deadlines()).toEqual([
      { key: `r1:${m.id}:PLAYING:v${m.phaseVersion}:t${m.turnId}`, endsAt: m.timer.endsAt },
    ]);
  });

  it("pauses at a turn boundary when a team has nobody online, keeping the full turn", () => {
    const h = ordered([1, 2]);
    const m = h.match();
    const waiting = m.teams[m.askingTeam === 0 ? 1 : 0];
    for (const id of waiting.members) h.setConnected(id, false);
    const nextIndex = waiting.nextIndex;
    h.tick(120_000);
    h.expireDue();
    const paused = h.match();
    expect(paused.paused).toBe(true);
    expect(paused.pauseReason).toBe("offline");
    expect(paused.speakerId).toBeNull();
    expect(paused.turnId).toBe(m.turnId + 1);
    expect(paused.timer).toEqual({ endsAt: null, pausedRemainingMs: 120_000, durationMs: 120_000 });
    expect(paused.teams[m.askingTeam === 0 ? 1 : 0].nextIndex).toBe(nextIndex);
    expect(h.deadlines()).toEqual([]);
  });

  it("skips disconnected candidates when choosing the next speaker", () => {
    const h = ordered([1, 3]);
    const m = h.match();
    const [, C, D] = m.teams[m.askingTeam === 0 ? 1 : 0].members;
    const [B] = m.teams[m.askingTeam === 0 ? 1 : 0].members;
    h.setConnected(B!, false);
    expect(h.match().nextSpeakerId).toBe(C);
    const out = speakers(h, 4);
    expect(out[1]).toBe(C);
    expect(out[3]).toBe(D);
    const counts = h.match().connectedCounts;
    expect(counts[m.askingTeam]).toBe(1);
    expect(counts[m.askingTeam === 0 ? 1 : 0]).toBe(2);
  });

  it("parses custom configs", () => {
    expect(configSchema.parse({ turnSeconds: 15, voteSeconds: 10 }).cooldownSeconds).toBe(5);
  });
});
