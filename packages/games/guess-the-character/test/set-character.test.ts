import { describe, expect, it } from "vitest";
import { categories } from "../src/content.js";
import { guard, playing, setCharacters, type Harness } from "./helpers.js";

const SUPERHEROES = categories().find((c) => c.id === "superheroes")!.characterIds;

/** Red (team 0) holds Thor, Blue (team 1) holds Spider-Man, category Superheroes. */
function fixture(sizes = [2, 2]) {
  const h = playing(sizes);
  setCharacters(h, 0, "thor", "spider-man");
  const next = structuredClone(h.shared);
  next.matches[0]!.categoryId = "superheroes";
  h.shared = next;
  return { h, redId: h.match().teams[0].groupId, blueId: h.match().teams[1].groupId };
}
function change(h: Harness, actor: string, groupId: string, characterId: string | null) {
  return h.act(actor, "gc:setCharacter", { ...guard(h, h.match()), groupId, characterId });
}

describe("host changes a team's character", () => {
  it("sets a chosen character from the match category", () => {
    const { h, redId } = fixture();
    expect(change(h, "host", redId, "hulk")).not.toBeNull();
    expect(h.match().teams[0].characterId).toBe("hulk");
    expect(h.match().teams[1].characterId).toBe("spider-man");
  });

  it("rerolls to another character in the category, never the current or the opponent's", () => {
    for (let i = 0; i < 40; i++) {
      const { h, redId } = fixture();
      expect(change(h, "host", redId, null)).not.toBeNull();
      const picked = h.match().teams[0].characterId!;
      expect(SUPERHEROES).toContain(picked);
      expect(["thor", "spider-man"]).not.toContain(picked);
    }
  });

  it("rejects a character outside the category", () => {
    const { h, redId } = fixture();
    expect(change(h, "host", redId, "ariel")).toBeNull();
    expect(change(h, "host", redId, "no-such-character")).toBeNull();
    expect(h.match().teams[0].characterId).toBe("thor");
  });

  it("rejects the opponent's character and a no-op change", () => {
    const { h, redId } = fixture();
    expect(change(h, "host", redId, "spider-man")).toBeNull();
    expect(change(h, "host", redId, "thor")).toBeNull();
  });

  it("is host only", () => {
    const { h, redId } = fixture();
    const player = h.match().teams[0].members[0]!;
    expect(change(h, player, redId, "hulk")).toBeNull();
    expect(h.match().teams[0].characterId).toBe("thor");
  });

  it("rejects an unknown group, a stale guard and a wrong phase", () => {
    const { h, redId } = fixture();
    expect(change(h, "host", "nobody", "hulk")).toBeNull();
    const stale = { ...guard(h, h.match()), phaseVersion: h.match().phaseVersion - 1 };
    expect(
      h.act("host", "gc:setCharacter", { ...stale, groupId: redId, characterId: "hulk" }),
    ).toBeNull();
    const ended = (() => {
      const r = fixture();
      r.h.act("host", "gc:end", { ...guard(r.h, r.h.match()), turnId: r.h.match().turnId });
      return r;
    })();
    expect(change(ended.h, "host", ended.redId, "hulk")).toBeNull();
  });

  it("works while the match is paused", () => {
    const { h, redId } = fixture();
    h.act("host", "gc:pause", {
      ...guard(h, h.match()),
      turnId: h.match().turnId,
    });
    expect(change(h, "host", redId, "hulk")).not.toBeNull();
    expect(h.match().teams[0].characterId).toBe("hulk");
  });

  it("invalidates a guess typed against the old character without a cooldown", () => {
    const { h, blueId } = fixture();
    const guesser = h.match().teams[0];
    const version = guesser.guessVersion;
    expect(change(h, "host", blueId, "hulk")).not.toBeNull();
    const m = h.match();
    expect(m.teams[0].guessVersion).toBe(version + 1);
    expect(
      h.act(guesser.members[0]!, "gc:guess", {
        ...guard(h, m),
        guessVersion: version,
        name: "Spider-Man",
      }),
    ).toBeNull();
    expect(m.teams[0].cooldown.endsAt).toBeNull();
  });

  it("keeps turn, timer and phase untouched", () => {
    const { h, redId } = fixture();
    const before = h.match();
    change(h, "host", redId, "hulk");
    const after = h.match();
    expect(after.turnId).toBe(before.turnId);
    expect(after.timer).toEqual(before.timer);
    expect(after.phaseVersion).toBe(before.phaseVersion);
  });

  it("gives only the host the picker pool, and never reveals it to players", () => {
    const { h } = fixture();
    const host = h.view({ kind: "host" }).privateMatches[0]!;
    expect(host.characterPool!.map((c) => c.id).sort()).toEqual([...SUPERHEROES].sort());
    const member = h.match().teams[0].members[0]!;
    const player = h.view({ kind: "player", playerId: member }).privateMatches[0]!;
    expect(player.characterPool).toBeNull();
  });
});
