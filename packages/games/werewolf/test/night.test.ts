import { describe, expect, it } from "vitest";
import { DAWN_MS, REVEAL_MS, type Role } from "../src/types.js";
import type { WerewolfShared } from "../src/WerewolfShared.js";
import { HOST, act, config, fire, player, setupShared } from "./helpers.js";

/** p1,p2 werewolves; p3 seer; p4 guard; p5,p6 villagers. */
const SIX: Role[] = ["werewolf", "werewolf", "seer", "guard", "villager", "villager"];

function night1(roles: Role[] = SIX): WerewolfShared {
  const started = act(setupShared(roles), HOST, "ww:start")!;
  return fire(started);
}
const vote = (s: WerewolfShared, who: string, target: string) => act(s, player(who), "ww:wolfVote", { targetId: target });
const seer = (s: WerewolfShared, who: string, target: string) => act(s, player(who), "ww:seerPick", { targetId: target });
const guard = (s: WerewolfShared, who: string, target: string) => act(s, player(who), "ww:guardPick", { targetId: target });

describe("starting the night", () => {
  it("REVEAL due -> NIGHT 1 with a nightSeconds deadline", () => {
    const s = night1();
    expect(s.stage).toBe("NIGHT");
    expect(s.night).toBe(1);
    expect(s.deadline).toEqual({ key: "NIGHT:1", endsAt: REVEAL_MS + config.nightSeconds * 1000 });
  });
});

describe("ww:wolfVote", () => {
  it("lets a living werewolf pick a living non-werewolf and change their mind", () => {
    let s = vote(night1(), "p1", "p5")!;
    expect(s.wolfVotes).toEqual({ p1: "p5" });
    s = vote(s, "p1", "p6")!;
    expect(s.wolfVotes).toEqual({ p1: "p6" });
  });
  it("rejects non-werewolves, wolf targets, self, dead and unknown targets, and the wrong stage", () => {
    const s = night1();
    expect(vote(s, "p5", "p6")).toBeNull();
    expect(vote(s, "p1", "p2")).toBeNull();
    expect(vote(s, "p1", "p1")).toBeNull();
    expect(vote(s, "p1", "nobody")).toBeNull();
    const dead = structuredClone(s);
    dead.players.p6!.alive = false;
    expect(vote(dead, "p1", "p6")).toBeNull();
    const deadWolf = structuredClone(s);
    deadWolf.players.p1!.alive = false;
    expect(vote(deadWolf, "p1", "p5")).toBeNull();
    expect(act(act(setupShared(SIX), HOST, "ww:start")!, player("p1"), "ww:wolfVote", { targetId: "p5" })).toBeNull();
    expect(act(s, HOST, "ww:wolfVote", { targetId: "p5" })).toBeNull();
  });
});

describe("ww:seerPick", () => {
  it("records an immediate binary result in the log and locks the first pick", () => {
    let s = seer(night1(), "p3", "p1")!;
    expect(s.seerLog).toEqual([{ night: 1, targetId: "p1", isWerewolf: true }]);
    expect(seer(s, "p3", "p5")).toBeNull();
    s = seer(night1(), "p3", "p5")!;
    expect(s.seerLog[0]).toMatchObject({ targetId: "p5", isWerewolf: false });
  });
  it("rejects non-seers, self and dead or unknown targets", () => {
    const s = night1();
    expect(seer(s, "p5", "p1")).toBeNull();
    expect(seer(s, "p3", "p3")).toBeNull();
    expect(seer(s, "p3", "nobody")).toBeNull();
    const dead = structuredClone(s);
    dead.players.p1!.alive = false;
    expect(seer(dead, "p3", "p1")).toBeNull();
  });
});

describe("ww:guardPick", () => {
  it("protects anyone, including the same player two nights in a row", () => {
    const s = guard(night1(), "p4", "p5")!;
    expect(s.guardPick).toBe("p5");
    const night2 = structuredClone(fire(s));
    night2.stage = "NIGHT";
    night2.night = 2;
    night2.guardPick = null;
    expect(guard(night2, "p4", "p5")!.guardPick).toBe("p5");
  });
  it("allows protecting yourself once per game, and changing a pick does not spend it", () => {
    let s = guard(night1(), "p4", "p4")!;
    s = guard(s, "p4", "p5")!; // changed their mind
    s = fire(s);
    expect(s.guardSelfUsed).toBe(false);
    let t = guard(night1(), "p4", "p4")!;
    t = fire(t);
    expect(t.guardSelfUsed).toBe(true);
    const night2 = structuredClone(t);
    night2.stage = "NIGHT";
    night2.night = 2;
    night2.guardPick = null;
    expect(guard(night2, "p4", "p4")).toBeNull();
    expect(guard(night2, "p4", "p5")).not.toBeNull();
  });
  it("rejects non-guards", () => {
    expect(guard(night1(), "p5", "p6")).toBeNull();
  });
});

describe("dawn", () => {
  it("a protected target survives: nobody dies", () => {
    let s = vote(night1(), "p1", "p5")!;
    s = vote(s, "p2", "p5")!;
    s = guard(s, "p4", "p5")!;
    s = fire(s);
    expect(s.stage).toBe("DAWN");
    expect(s.dawn).toEqual({ eliminatedId: null });
    expect(s.players.p5!.alive).toBe(true);
    expect(s.deadline).toEqual({ key: "DAWN:1", endsAt: REVEAL_MS + config.nightSeconds * 1000 + DAWN_MS });
  });
  it("an unprotected target dies", () => {
    let s = vote(night1(), "p1", "p5")!;
    s = vote(s, "p2", "p5")!;
    s = guard(s, "p4", "p6")!;
    s = fire(s);
    expect(s.dawn).toEqual({ eliminatedId: "p5" });
    expect(s.players.p5!.alive).toBe(false);
  });
  it("with no actions at all the night still ends on time and nobody dies", () => {
    const s = fire(night1());
    expect(s.stage).toBe("DAWN");
    expect(s.dawn).toEqual({ eliminatedId: null });
    expect(Object.values(s.players).every((p) => p.alive)).toBe(true);
  });
  it("never ends early, even when every actor has chosen", () => {
    let s = vote(night1(), "p1", "p5")!;
    s = vote(s, "p2", "p5")!;
    s = seer(s, "p3", "p1")!;
    s = guard(s, "p4", "p5")!;
    expect(s.stage).toBe("NIGHT");
    expect(s.deadline!.key).toBe("NIGHT:1");
  });
});

describe("a dawn kill that decides the game", () => {
  it("is announced first (winner hidden), then ENDED when the DAWN deadline is due", () => {
    const base = night1();
    base.players.p4!.alive = false; // guard already dead: alive = p1,p2 wolves + p3,p5,p6
    base.players.p3!.alive = false; // seer dead too: others = p5,p6
    let s = vote(base, "p1", "p5")!;
    s = vote(s, "p2", "p5")!;
    s = fire(s);
    expect(s.stage).toBe("DAWN");
    expect(s.dawn).toEqual({ eliminatedId: "p5" });
    expect(s.winner).toBeNull();
    expect(s.pendingWinner).toBe("wolves");
    s = fire(s);
    expect(s.stage).toBe("ENDED");
    expect(s.winner).toBe("wolves");
    expect(s.deadline).toBeNull();
  });
  it("a DAWN with no winner goes on to DISCUSSION", () => {
    const s = fire(fire(night1()));
    expect(s.stage).toBe("DISCUSSION");
    expect(s.deadline!.key).toBe("DISCUSSION:1");
  });
});
