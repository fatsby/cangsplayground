import { createRng } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import { INTRO_BANNED_TERMS, scenePresets } from "../src/cases/scenes.js";
import { caseTemplates } from "../src/cases/catalogue.js";
import { generateCase } from "../src/generate.js";
import { buildIntro } from "../src/intro.js";
import { validateCase } from "../src/validate.js";

const scenes = () => scenePresets();

describe("scene presets", () => {
  it("ship at least two scenes with enough pool entries", () => {
    expect(
      scenes()
        .map((s) => s.id)
        .sort(),
    ).toEqual(["hotel-night", "manor-night"]);
    for (const scene of scenes()) {
      expect(scene.roomPool.length).toBeGreaterThanOrEqual(4);
      expect(scene.weaponPool.length).toBeGreaterThanOrEqual(3);
      expect(scene.victimLooks.length).toBeGreaterThanOrEqual(3);
      expect(scene.suspectPool.length).toBeGreaterThanOrEqual(4);
      expect(scene.foundPlaces.length).toBeGreaterThanOrEqual(1);
      for (const suspect of scene.suspectPool) {
        expect(scene.badgeByRole[suspect.role]).toBeDefined();
      }
      expect(new Set(scene.roomPool.map((r) => r.name)).size).toBe(scene.roomPool.length);
    }
  });

  it("do not reuse the sample names of the approved mockup", () => {
    const text = JSON.stringify(scenes());
    expect(text).not.toMatch(/Blackwood|Edmund Hale/);
  });
});

describe("every scene works with every logical configuration", () => {
  for (const scene of scenes()) {
    for (const template of caseTemplates()) {
      it(`${scene.id} x ${template.familyId}/${template.variantId}`, () => {
        const c = generateCase(7, {
          familyId: template.familyId,
          variantId: template.variantId,
          sceneId: scene.id,
        });
        expect(c.sceneId).toBe(scene.id);
        expect(c.intro.sceneId).toBe(scene.id);
        expect(validateCase(c.logic).ok).toBe(true);
        expect(Object.keys(c.intro.roomShapes).sort()).toEqual(
          c.briefing.rooms.map((r) => r.id).sort(),
        );
        expect(Object.keys(c.intro.suspectBadges).sort()).toEqual(
          c.briefing.suspects.map((s) => s.id).sort(),
        );
      });
    }
  }
});

describe("buildIntro", () => {
  const briefing = () =>
    generateCase(5, { familyId: "alibi", variantId: "window", sceneId: "manor-night" }).briefing;
  const scene = scenes().find((s) => s.id === "manor-night")!;

  it("is deterministic for the same briefing and rng", () => {
    const a = buildIntro({ scene, briefing: briefing(), rng: createRng(99) });
    const b = buildIntro({ scene, briefing: briefing(), rng: createRng(99) });
    expect(b).toEqual(a);
  });

  it("varies across seeds, so a constant descriptor would fail", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateCase(seed);
      seen.add(
        JSON.stringify(c.intro, (k, v) =>
          k === "roomShapes" || k === "suspectBadges" ? Object.values(v) : v,
        ),
      );
    }
    expect(seen.size).toBeGreaterThan(5);
    const scenesSeen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) scenesSeen.add(generateCase(seed).sceneId);
    expect(scenesSeen.size).toBe(2);
  });

  it("never carries a weapon, family, variant, seed or violent vocabulary", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateCase(seed);
      const text = JSON.stringify(c.intro).toLowerCase();
      for (const weapon of [
        ...c.briefing.weapons.map((w) => w.name),
        ...c.briefing.weapons.map((w) => w.id),
      ]) {
        expect(text).not.toContain(weapon.toLowerCase());
      }
      // whole words only: the descriptor legitimately has an "accessory" key
      expect(text).not.toMatch(new RegExp(`\\b${c.familyId}\\b`));
      expect(text).not.toMatch(new RegExp(`\\b${c.variantId}\\b`));
      expect(text).not.toContain(`"${c.seed}"`);
      for (const term of INTRO_BANNED_TERMS) expect(text).not.toMatch(new RegExp(`\\b${term}\\b`));
    }
  });

  it("captions say where the body was found and never name a crime room", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const c = generateCase(seed);
      const captions = Object.values(c.intro.captions).join(" ");
      expect(c.intro.captions.found.toLowerCase()).toContain("found");
      expect(c.intro.captions.found).toContain(c.briefing.bodyFoundAt);
      for (const room of c.briefing.rooms) expect(captions).not.toContain(room.name);
      expect(captions).not.toMatch(/\{[a-z]+\}/);
    }
  });

  it("describes only the body-found place, listed in the scene", () => {
    const c = generateCase(2);
    const sceneUsed = scenes().find((s) => s.id === c.sceneId)!;
    expect(sceneUsed.foundPlaces.map((p) => p.kind)).toContain(c.intro.foundPlace);
    expect(sceneUsed.foundPlaces.find((p) => p.kind === c.intro.foundPlace)!.label).toBe(
      c.briefing.bodyFoundAt,
    );
  });
});
