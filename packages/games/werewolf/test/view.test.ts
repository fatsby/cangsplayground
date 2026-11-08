import { describe, expect, it } from "vitest";
import type { Viewer } from "@cangsplayground/core";
import werewolf from "../src/index.js";
import { viewForViewer } from "../src/view.js";
import type { WerewolfShared } from "../src/WerewolfShared.js";
import { ROLES, type Role } from "../src/types.js";
import { HOST, act, config, fire, player, setupShared } from "./helpers.js";

/** p1,p2 werewolves; p3 seer; p4 guard; p5,p6 villagers. */
const SIX: Role[] = ["werewolf", "werewolf", "seer", "guard", "villager", "villager"];
const PROJECTOR: Viewer = { kind: "projector" };

function night(): WerewolfShared {
  return fire(act(setupShared(SIX), HOST, "ww:start")!);
}
/** The same night after every acting role has chosen. */
function nightWithActions(): WerewolfShared {
  let s = night();
  s = act(s, player("p1"), "ww:wolfVote", { targetId: "p5" })!;
  s = act(s, player("p2"), "ww:wolfVote", { targetId: "p5" })!;
  s = act(s, player("p3"), "ww:seerPick", { targetId: "p1" })!;
  return act(s, player("p4"), "ww:guardPick", { targetId: "p6" })!;
}
function vote(): WerewolfShared {
  let s = fire(fire(fire(night())));
  s = act(s, player("p5"), "ww:dayVote", { targetId: "p1" })!;
  return act(s, player("p6"), "ww:dayVote", { targetId: "p1" })!;
}
const view = (s: WerewolfShared, viewer: Viewer) => viewForViewer(s, viewer);
/** Every string value anywhere in the payload (keys excluded). */
function strings(x: unknown, out: string[] = []): string[] {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x && typeof x === "object") Object.values(x).forEach((v) => strings(v, out));
  return out;
}
const ROLE_WORDS: string[] = [...ROLES];

describe("host", () => {
  it("sees every role, the night's live choices and who voted for whom", () => {
    const n = view(nightWithActions(), HOST);
    expect(n.roles).toEqual({ p1: "werewolf", p2: "werewolf", p3: "seer", p4: "guard", p5: "villager", p6: "villager" });
    expect(n.hostNight).toEqual({ wolfVotes: { p1: "p5", p2: "p5" }, seerPick: "p1", guardPick: "p6" });
    expect(n.me).toBeNull();
    const v = view(vote(), HOST);
    expect(v.hostVotes).toEqual({ p5: "p1", p6: "p1" });
    expect(v.hostNight).toBeNull();
  });
});

describe("projector", () => {
  it("sees only public information while the game runs", () => {
    for (const s of [night(), nightWithActions(), vote()]) {
      const v = view(s, PROJECTOR);
      expect(v.roles).toBeNull();
      expect(v.me).toBeNull();
      expect(v.hostNight).toBeNull();
      expect(v.hostVotes).toBeNull();
      expect(strings(v).filter((x) => ROLE_WORDS.includes(x))).toEqual([]);
    }
  });
  it("sees vote totals but never who voted", () => {
    const v = view(vote(), PROJECTOR);
    expect(v.voteCounts).toEqual({ p1: 2 });
    expect(v.needed).toBe(3);
    expect(JSON.stringify(v)).not.toContain("p5\":\"p1");
  });
});

describe("players", () => {
  it("a werewolf sees the pack and the pack's night votes, and nothing else secret", () => {
    const v = view(nightWithActions(), player("p1"));
    expect(v.me).toMatchObject({
      role: "werewolf",
      alive: true,
      teammates: ["p2"],
      wolfVotes: { p1: "p5", p2: "p5" },
      seerLog: null,
      guardSelfUsed: null,
      myNightPick: "p5",
    });
    expect(v.roles).toBeNull();
    expect(v.hostNight).toBeNull();
  });
  it("the seer sees their own log and pick only", () => {
    const v = view(nightWithActions(), player("p3"));
    expect(v.me).toMatchObject({ role: "seer", seerLog: [{ night: 1, targetId: "p1", isWerewolf: true }], myNightPick: "p1", wolfVotes: null, teammates: [] });
  });
  it("the guard sees whether the self-protection is spent and their pick", () => {
    const v = view(nightWithActions(), player("p4"));
    expect(v.me).toMatchObject({ role: "guard", guardSelfUsed: false, myNightPick: "p6", seerLog: null, wolfVotes: null });
  });
  it("a villager sees no night information at all", () => {
    const v = view(nightWithActions(), player("p5"));
    expect(v.me).toEqual({
      role: "villager",
      alive: true,
      pending: false,
      teammates: [],
      wolfVotes: null,
      seerLog: null,
      guardSelfUsed: null,
      myVote: null,
      myNightPick: null,
    });
    expect(strings(v).filter((x) => x === "werewolf" || x === "seer" || x === "guard")).toEqual([]);
  });
  it("a villager's night view is identical whether or not anyone has acted (no 'has acted' leak)", () => {
    expect(JSON.stringify(view(night(), player("p5")))).toBe(JSON.stringify(view(nightWithActions(), player("p5"))));
    expect(JSON.stringify(view(night(), PROJECTOR))).toBe(JSON.stringify(view(nightWithActions(), PROJECTOR)));
  });
  it("sees their own vote and the public totals during the vote", () => {
    const v = view(vote(), player("p5"));
    expect(v.me!.myVote).toBe("p1");
    expect(v.voteCounts).toEqual({ p1: 2 });
    expect(v.hostVotes).toBeNull();
  });
  it("an eliminated player keeps their own role but learns nothing about others", () => {
    const s = nightWithActions();
    s.players.p6!.alive = false;
    const v = view(s, player("p6"));
    expect(v.me).toMatchObject({ role: "villager", alive: false });
    expect(v.roles).toBeNull();
    expect(v.players.find((p) => p.id === "p6")!.alive).toBe(false);
  });
  it("a waiting late joiner has no role until they enter play", () => {
    const s = night();
    s.players.p7 = { role: "seer", alive: true, pending: true };
    s.order.push("p7");
    const v = view(s, player("p7"));
    expect(v.me).toMatchObject({ role: null, pending: true });
    expect(v.players.find((p) => p.id === "p7")).toEqual({ id: "p7", alive: true, pending: true });
    expect(strings(v).filter((x) => x === "seer")).toEqual([]);
    expect(view(s, HOST).roles!.p7).toBe("seer");
  });
  it("an unknown player gets no personal state", () => {
    expect(view(night(), player("stranger")).me).toBeNull();
  });
});

describe("dawn, verdict and the end", () => {
  it("a dawn kill is public but the winner stays hidden until ENDED", () => {
    let s = act(setupShared(["werewolf", "werewolf", "seer", "villager", "villager"]), HOST, "ww:start")!;
    s = fire(s);
    s.players.p3!.alive = false;
    s = act(s, player("p1"), "ww:wolfVote", { targetId: "p5" })!;
    s = fire(s);
    expect(s.pendingWinner).toBe("wolves");
    for (const viewer of [HOST, PROJECTOR, player("p4")]) {
      const v = view(s, viewer);
      expect(v.winner).toBeNull();
      expect(v.dawn).toEqual({ eliminatedId: "p5" });
    }
    s = fire(s);
    for (const viewer of [HOST, PROJECTOR, player("p4"), player("p5")]) {
      const v = view(s, viewer);
      expect(v.winner).toBe("wolves");
      expect(v.roles).toMatchObject({ p1: "werewolf", p4: "villager" });
    }
  });
  it("the verdict's totals are public during VERDICT", () => {
    const s = fire(vote());
    const v = view(s, PROJECTOR);
    expect(v.lastVote).toEqual({ eliminatedId: null, counts: { p1: 2 } });
    expect(v.voteCounts).toEqual({});
  });
});

describe("module wiring", () => {
  it("sharedViewFor delegates to viewForViewer", () => {
    const s = night();
    expect(
      werewolf.sharedViewFor!({ config, shared: s, viewer: player("p5"), viewerGroupId: "g1" }),
    ).toEqual(view(s, player("p5")));
  });
});
