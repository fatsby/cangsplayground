import { describe, expect, it } from "vitest";
import { characterById } from "../src/content.js";
import { controlGuard, guard, playing, setCharacters, start, type Harness } from "./helpers.js";

/** Two matches; match 0 holds Thor (team 0) vs Spider-Man (team 1). */
function fixture() {
  const h = playing([2, 2, 1, 1]);
  setCharacters(h, 0, "thor", "spider-man");
  setCharacters(h, 1, "hulk", "batman");
  return h;
}
const player = (id: string) => ({ kind: "player" as const, playerId: id });
/** Character names and aliases a view must not carry, excluding the public examples. */
function leaks(view: unknown, ids: string[]) {
  const { categories, ...rest } = view as { categories: unknown };
  void categories;
  const text = JSON.stringify(rest).toLowerCase();
  return ids.filter((id) => {
    const c = characterById(id);
    return [id, c.name, ...c.aliases].some((n) => text.includes(n.toLowerCase()));
  });
}
function win(h: Harness, index: number) {
  const m = h.match(index);
  h.act(m.teams[0].members[0]!, "gc:guess", {
    ...guard(h, m),
    guessVersion: m.teams[0].guessVersion,
    name: characterById(m.teams[1].characterId!).name,
  });
}

describe("role-filtered views", () => {
  it("host sees every character, vote and cooldown", () => {
    const h = fixture();
    const v = h.view({ kind: "host" });
    expect(v.privateMatches).toHaveLength(2);
    expect(v.privateMatches[0]!.characters.map((c) => c.character?.name)).toEqual([
      "Thor",
      "Spider-Man",
    ]);
    expect(v.privateMatches[0]!.votes).toEqual({});
    expect(v.privateMatches[0]!.teams).toHaveLength(2);
    expect(v.myVote).toBeNull();
  });

  it("a playing student sees only their own team's character and cooldown", () => {
    const h = fixture();
    const red = h.match().teams[0];
    const v = h.view(player(red.members[0]!), red.groupId);
    expect(v.ownMatchId).toBe(h.match().id);
    expect(v.privateMatches).toHaveLength(1);
    expect(v.privateMatches[0]!.characters).toEqual([
      { groupId: red.groupId, character: { id: "thor", name: "Thor" } },
      { groupId: h.match().teams[1].groupId, character: null },
    ]);
    expect(v.privateMatches[0]!.teams.map((t) => t.groupId)).toEqual([red.groupId]);
    expect(v.privateMatches[0]!.votes).toBeNull();
    expect(leaks(v, ["spider-man", "hulk", "batman"])).toEqual([]);
    expect(v.canStart).toBe(false);
    expect(v.canNewRound).toBe(false);
  });

  it("projector, other pairs and late joiners get no private data", () => {
    const h = fixture();
    const other = h.match(1).teams[0].members[0]!;
    h.join("late", null);
    for (const v of [
      h.view({ kind: "projector" }),
      h.view(player(other), h.match(1).teams[0].groupId),
      h.view(player("late")),
    ]) {
      if (v.ownMatchId !== h.match(1).id) expect(leaks(v, ["thor", "spider-man"])).toEqual([]);
      expect(v.canStart || v.canNewRound).toBe(false);
    }
    expect(h.view({ kind: "projector" }).privateMatches).toEqual([]);
    expect(h.view(player("late")).privateMatches).toEqual([]);
    expect(h.view(player("late")).ownMatchId).toBeNull();
    expect(leaks(h.view({ kind: "projector" }), ["thor", "spider-man", "hulk", "batman"])).toEqual(
      [],
    );
  });

  it("no secrets before PLAYING; both answers only to that pair after it ends", () => {
    const h = start([1, 1, 1, 1]);
    const a = h.match().teams[0];
    expect(
      h.view(player(a.members[0]!)).privateMatches[0]!.characters.every((c) => !c.character),
    ).toBe(true);
    h.act("host", "gc:start", { round: 1 });
    expect(
      h.view(player(a.members[0]!)).privateMatches[0]!.characters.every((c) => !c.character),
    ).toBe(true);
    h.tick(30_000);
    h.expireDue();
    setCharacters(h, 0, "thor", "spider-man");
    setCharacters(h, 1, "hulk", "batman");
    win(h, 0);
    const done = h.view(player(a.members[0]!));
    expect(done.privateMatches[0]!.characters.map((c) => c.character?.name)).toEqual([
      "Thor",
      "Spider-Man",
    ]);
    // The other pair is still playing in its category; nothing from match 0 leaks there.
    const other = h.match(1).teams[0].members[0]!;
    expect(leaks(h.view(player(other)), ["thor", "spider-man"])).toEqual([]);
    expect(leaks(h.view({ kind: "projector" }), ["thor", "spider-man", "hulk", "batman"])).toEqual(
      [],
    );
    expect(h.view({ kind: "projector" }).matches[0]!.winnerGroupId).toBe(a.groupId);
  });

  it("shows individual votes to the host and only my own vote to me", () => {
    const h = start([2, 2]);
    h.act("host", "gc:start", { round: 1 });
    const m = h.match();
    const [me, mate] = m.teams[0].members;
    h.act(me!, "gc:vote", { ...guard(h, m), categoryId: "superheroes" });
    h.act(mate!, "gc:vote", { ...guard(h, m), categoryId: "anime-manga" });
    expect(h.view(player(me!)).myVote).toBe("superheroes");
    expect(JSON.stringify(h.view(player(me!)))).not.toContain(mate!.concat('":"anime'));
    expect(h.view(player(me!)).privateMatches[0]!.votes).toBeNull();
    expect(h.view({ kind: "host" }).privateMatches[0]!.votes).toEqual({
      [me!]: "superheroes",
      [mate!]: "anime-manga",
    });
    expect(h.view({ kind: "projector" }).matches[0]).toMatchObject({
      votedCount: 2,
      voterCount: 4,
    });
    expect(h.view({ kind: "projector" }).myVote).toBeNull();
  });

  it("never projects raw pools, aliases or the shared object", () => {
    const h = fixture();
    for (const viewer of [{ kind: "host" as const }, { kind: "projector" as const }]) {
      const v = h.view(viewer);
      const text = JSON.stringify(v);
      expect(text).not.toContain("characterIds");
      expect(text).not.toContain("aliases");
      expect(text).not.toContain('guessVersion":' + "undefined");
      expect(Object.keys(v.matches[0]!)).not.toContain("teams");
      expect(Object.keys(v.matches[0]!)).not.toContain("votes");
    }
    expect(Object.keys(h.view({ kind: "host" }).categories[0]!).sort()).toEqual([
      "examples",
      "id",
      "name",
    ]);
  });

  it("returned views are copies", () => {
    const h = fixture();
    const v = h.view({ kind: "host" });
    v.matches[0]!.members[0].push("intruder");
    v.matches[0]!.timer.endsAt = 1;
    v.privateMatches[0]!.votes!.x = "superheroes";
    v.privateMatches[0]!.teams[0]!.cooldown.endsAt = 5;
    expect(h.match().teams[0].members).not.toContain("intruder");
    expect(h.match().timer.endsAt).not.toBe(1);
    expect(h.match().votes).toEqual({});
    expect(h.match().teams[0].cooldown.endsAt).toBeNull();
  });

  it("reports paused state, speakers and start/new-round availability", () => {
    const h = fixture();
    const m = h.match();
    h.act("host", "gc:pause", controlGuard(h, m));
    const v = h.view({ kind: "projector" });
    expect(v.matches[0]).toMatchObject({
      paused: true,
      pauseReason: "host",
      speakerId: m.speakerId,
    });
    expect(v.matches[0]!.askingGroupId).toBe(m.teams[m.askingTeam].groupId);
    expect(h.view({ kind: "host" }).canNewRound).toBe(false);
    expect(start([1, 1]).view({ kind: "host" }).canStart).toBe(true);
  });
});
