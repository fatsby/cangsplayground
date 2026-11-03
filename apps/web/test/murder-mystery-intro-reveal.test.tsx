// @vitest-environment happy-dom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseBriefing, IntroDescriptor } from "@cangsplayground/game-murder-mystery";
import views, { IntroStage } from "@cangsplayground/game-murder-mystery/views";
import { propsFor } from "./murder-mystery-fixture";

const INTRO_MS = 13_000;
const Projector = views.ProjectorScreen!;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

const entity = (id: string, name: string) => ({ id, name, description: `${name} description` });

function fixture(tag: string, scene: IntroDescriptor["sceneId"]) {
  const briefing: CaseBriefing = {
    title: `The ${tag} Affair`,
    opening: `Opening of ${tag}.`,
    victim: entity("v", `${tag} Victim`),
    bodyFoundAt: `the ${tag} path`,
    suspects: ["a", "b", "c", "d"].map((k) => entity(`s${k}`, `${tag} Suspect ${k}`)),
    weapons: ["a", "b", "c"].map((k) => entity(`w${k}`, `${tag} Weapon ${k}`)),
    rooms: ["a", "b", "c", "d"].map((k) => entity(`r${k}`, `${tag} Room ${k}`)),
  };
  const intro: IntroDescriptor = {
    sceneId: scene,
    victimLook: {
      hair: scene === "manor-night" ? "white" : "dark",
      coat: "indigo",
      accessory: "bowtie",
    },
    foundPlace: scene === "manor-night" ? "garden-path" : "service-corridor",
    discoveredAt: "10:20 p.m.",
    roomShapes: { ra: "arched", rb: "square", rc: "low", rd: "round" },
    suspectBadges: { sa: "hat", sb: "glasses", sc: "apron", sd: "bowtie" },
    captions: {
      setting: `${tag} setting caption`,
      walk: `${tag} walk caption`,
      blackout: `${tag} blackout caption`,
      found: `${tag} is found at the ${tag} path`,
    },
  };
  return { briefing, intro };
}
const A = fixture("Alpha", "manor-night");
const B = fixture("Bravo", "hotel-night");

const stage = (f: typeof A, elapsedMs: number | null, reduced = false, decorSeed = 7) => (
  <IntroStage {...f} elapsedMs={elapsedMs} reduced={reduced} decorSeed={decorSeed} />
);
const markup = (f: typeof A, elapsedMs: number | null, reduced = false) =>
  renderToStaticMarkup(stage(f, elapsedMs, reduced));

describe("IntroStage is driven by data", () => {
  it("renders each fixture's own labels and none of the other's", () => {
    const a = markup(A, INTRO_MS);
    const b = markup(B, INTRO_MS);
    for (const word of ["Alpha Victim", "Alpha Room a", "Alpha Suspect a", "The Alpha Affair"]) {
      expect(a).toContain(word);
      expect(b).not.toContain(word);
    }
    for (const word of ["Bravo Victim", "Bravo Room d", "Bravo Suspect c", "The Bravo Affair"]) {
      expect(b).toContain(word);
      expect(a).not.toContain(word);
    }
    expect(a).toContain('data-scene="manor-night"');
    expect(b).toContain('data-scene="hotel-night"');
  });

  it("draws different art for different scenes and looks", () => {
    const strip = (html: string) => html.replace(/Alpha|Bravo/g, "X");
    expect(strip(markup(A, INTRO_MS))).not.toEqual(strip(markup(B, INTRO_MS)));
  });

  it("renders identical markup for identical props: nothing random in render", () => {
    expect(markup(A, 6500)).toBe(markup(A, 6500));
    expect(renderToStaticMarkup(stage(A, 6500, false, 99))).not.toBe(markup(A, 6500));
  });

  it("never hardcodes the mockup's sample names in rendered output or in the view sources", () => {
    const html = markup(A, INTRO_MS) + markup(B, INTRO_MS);
    expect(html).not.toMatch(/Blackwood|Edmund|Hale/);
    const dir = join(__dirname, "../../../packages/games/murder-mystery/src/views");
    for (const file of readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f))) {
      expect(readFileSync(join(dir, file), "utf8"), file).not.toMatch(/Blackwood|Edmund Hale/);
    }
  });

  it("opens on the first frame and ends on title, found scene and four suspects", () => {
    const first = markup(A, 0);
    expect(first).toContain("Alpha setting caption");
    const pending = (html: string, part: string) =>
      (html.match(new RegExp(`data-part="${part}"[^>]*data-pending="true"`, "g")) ?? []).length;
    expect(pending(first, "title")).toBe(1);
    expect(pending(first, "suspect")).toBe(4);

    for (const final of [markup(A, INTRO_MS), markup(A, 0, true), markup(A, 99_999)]) {
      expect(pending(final, "title")).toBe(0);
      expect(pending(final, "suspect")).toBe(0);
      expect((final.match(/data-part="suspect"/g) ?? []).length).toBe(4);
      expect(final).toContain("Alpha Victim");
      expect(final).toContain("Alpha is found at the Alpha path");
      expect(final).toContain("10:20 p.m.");
      expect(final).toContain("Who did it?");
    }
  });

  it("shows the four rooms' names and the right caption for each beat", () => {
    expect(markup(A, 1000)).toContain("Alpha setting caption");
    expect(markup(A, 4000)).toContain("Alpha walk caption");
    expect(markup(A, 6500)).toContain("Alpha blackout caption");
    expect(markup(A, 9000)).toContain("Alpha is found at the Alpha path");
    for (const room of A.briefing.rooms) expect(markup(A, 5000)).toContain(room.name);
  });

  it("depicts no weapon, no attacker identity and no crime room", () => {
    const html = markup(A, INTRO_MS);
    for (const weapon of A.briefing.weapons) expect(html).not.toContain(weapon.name);
    expect(html).not.toContain('data-part="weapon"');
    expect(html).toContain('data-part="attacker"');
    expect(html).not.toMatch(/blood/i);
  });
});

describe("ProjectorScreen in INTRO", () => {
  const props = (elapsedMs: number) => propsFor({ kind: "projector" }, "INTRO", { elapsedMs });
  const mount = (p: ReturnType<typeof props>) => act(async () => root.render(<Projector {...p} />));
  const pendingParts = (part: string) =>
    container.querySelectorAll(`[data-part="${part}"][data-pending="true"]`).length;

  it("plays the intro with no clue, draft, answer, score or weapon", async () => {
    const p = props(0);
    await mount(p);
    expect(container.querySelector("svg")).not.toBeNull();
    const text = container.textContent ?? "";
    for (const face of Object.values(p.shared.caseData.cards))
      expect(text).not.toContain(face.body);
    for (const weapon of p.shared.caseData.briefing.weapons)
      expect(text).not.toContain(weapon.name);
    expect(container.querySelector("[data-total]")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(pendingParts("suspect")).toBe(4);
  });

  it("resumes at the right frame after a reload, and shows the last frame past the end", async () => {
    await mount(props(12_000));
    expect(pendingParts("title")).toBe(0);
    await mount(props(60_000));
    expect(pendingParts("suspect")).toBe(0);
  });

  it("freezes while the host has paused the intro", async () => {
    const p = props(9_000);
    const remaining = 3_000;
    const paused = {
      ...p,
      session: {
        ...p.session,
        shared: {
          ...p.view,
          paused: true,
          clock: { endsAt: null, remainingMs: remaining, durationMs: INTRO_MS },
        },
      },
    } as typeof p;
    await mount({ ...paused, serverNow: () => 1_000_000 + 500_000 });
    // 13 s - 3 s remaining = 10 s: the suspects (10.0 s+) have just begun, the title (11.4 s) has not
    expect(pendingParts("title")).toBe(1);
    await mount({ ...paused, serverNow: () => 1_000_000 + 900_000 });
    expect(pendingParts("title")).toBe(1);
  });

  it("shows the final frame at once when the system asks for reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    await mount(props(0));
    expect(pendingParts("title")).toBe(0);
    expect(pendingParts("suspect")).toBe(0);
  });
});
