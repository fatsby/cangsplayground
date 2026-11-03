import type { Viewer } from "@cangsplayground/core";
import { describe, expect, it } from "vitest";
import { INTRO_MS } from "../src/clock.js";
import { INTRO_BANNED_TERMS } from "../src/cases/scenes.js";
import { murderMystery } from "../src/index.js";
import { proofSets } from "../src/solver.js";
import type { Conclusion, MurderView, Phase } from "../src/types.js";
import { allRoutes, cardsAfter, leadOf, start, toInvestigation, type Harness } from "./helpers.js";

const HOST: Viewer = { kind: "host" };
const PROJECTOR: Viewer = { kind: "projector" };
const player = (playerId: string): Viewer => ({ kind: "player", playerId });

function view(h: Harness, viewer: Viewer, viewerGroupId?: string | null): MurderView {
  const group =
    viewerGroupId !== undefined
      ? viewerGroupId
      : viewer.kind === "player"
        ? (h.roster.find((r) => r.playerId === viewer.playerId)?.groupId ?? null)
        : null;
  return murderMystery.sharedViewFor!({
    config: h.config,
    shared: h.shared,
    viewer,
    viewerGroupId: group,
  }) as MurderView;
}

const VIEW_KEYS = [
  "briefing",
  "caseNumber",
  "clock",
  "hostDetails",
  "intro",
  "introMs",
  "investigationRound",
  "ownTeam",
  "paused",
  "phase",
  "phaseVersion",
  "progress",
  "results",
  "reveal",
  "revealStartedAt",
].sort();

const FORBIDDEN = [
  "actualWorldId",
  "publicConstraint",
  "proofSets",
  "worlds",
  "claims",
  "constraint",
  "contentVersion",
  "familyId",
  "variantId",
  "caseData",
  "factIds",
  "seed",
];

const team = (h: Harness, groupId = "g1") => h.shared.teams.find((t) => t.groupId === groupId)!;

/** Walks a class through every phase, calling `at` once in each. */
function walk(h: Harness, at: (phase: Phase) => void): void {
  at("READY");
  h.host("mm:start");
  at("INTRO");
  h.host("mm:next");
  at("BRIEFING");
  h.host("mm:next");
  at("SHARING");
  h.host("mm:next");
  at("INVESTIGATION");
  h.host("mm:next");
  h.host("mm:next");
  h.host("mm:next");
  h.host("mm:next");
  at("CONCLUSION");
  h.host("mm:next");
  at("AWAITING_REVEAL");
  h.host("mm:reveal");
  at("REVEALED");
}

function conclusionFor(h: Harness, route: string[]): Conclusion {
  const { logic, reveal } = h.shared.caseData;
  const known = cardsAfter(logic, route);
  return {
    ...reveal.answer,
    evidence: {
      suspectId: proofSets(logic, known, "suspectId")[0]!,
      weaponId: proofSets(logic, known, "weaponId")[0]!,
      roomId: proofSets(logic, known, "roomId")[0]!,
    },
  };
}

/** Plays the given routes (one per team) to the end of the conclusion with submissions. */
function playAll(h: Harness, routes: string[][]): void {
  toInvestigation(h);
  for (let round = 1; round <= 4; round++) {
    h.shared.teams.forEach((t, i) => {
      h.player(t.leadOrder[round - 1]!, "mm:investigate", {
        round,
        actionId: routes[i]![round - 1],
      });
    });
    h.host("mm:next");
  }
  h.shared.teams.forEach((t, i) => {
    const submitter = t.leadOrder[3]!;
    h.player(submitter, "mm:saveDraft", {
      draftVersion: 0,
      conclusion: conclusionFor(h, routes[i]!),
    });
    h.player(submitter, "mm:submit", { draftVersion: 1 });
  });
}

describe("module wiring", () => {
  it("describes a 3-4 player cooperative game with no generated data in public info", () => {
    expect(murderMystery).toMatchObject({
      id: "murder-mystery",
      minPlayersPerGroup: 3,
      maxPlayersPerGroup: 4,
    });
    expect(murderMystery.turnDurationMs(murderMystery.defaultConfig)).toBeNull();
    expect(JSON.stringify(murderMystery.publicInfo(murderMystery.defaultConfig))).toBe("{}");
    expect(murderMystery.configFields.map((f) => f.key)).toEqual([
      "briefingSeconds",
      "sharingSeconds",
      "investigationSeconds",
      "conclusionSeconds",
    ]);
    expect(murderMystery.unsupportedControls).toEqual(
      expect.arrayContaining(["pause", "resume", "skip", "extend", "reveal"]),
    );
  });

  it("rejects bad team sizes at Prepare and accepts an odd number of teams", () => {
    const group = (id: string, n: number) => ({
      id,
      playerIds: Array.from({ length: n }, (_, i) => `${id}-${i}`),
    });
    const check = (groups: ReturnType<typeof group>[]) =>
      murderMystery.validateGroups!({
        config: murderMystery.defaultConfig,
        groups: groups as never,
      });
    expect(check([group("g1", 3), group("g2", 4), group("g3", 3)])).toBeNull();
    expect(check([group("g1", 3)])).toBeNull();
    expect(check([group("g1", 2)])).toMatch(/3-4/);
    expect(check([group("g1", 3), group("g2", 5)])).toMatch(/g2/);
  });
});

describe("what each device may see", () => {
  it("opens the public file for the host at READY, the projector at INTRO and players at BRIEFING", () => {
    const h = start([3, 4]);
    walk(h, (phase) => {
      const started = phase !== "READY";
      const afterIntro = !["READY", "INTRO"].includes(phase);
      const host = view(h, HOST);
      const projector = view(h, PROJECTOR);
      const member = view(h, player("g1p1"));
      const late = view(h, player("late"), "g1");
      expect(host.briefing !== null, `host ${phase}`).toBe(true);
      expect(projector.briefing !== null, `projector ${phase}`).toBe(started);
      expect(member.briefing !== null, `player ${phase}`).toBe(afterIntro);
      expect(late.briefing !== null, `late ${phase}`).toBe(afterIntro);
      expect(host.intro !== null, `host intro ${phase}`).toBe(started);
      expect(projector.intro !== null, `projector intro ${phase}`).toBe(started);
      expect(member.intro).toBeNull();
      expect(late.intro).toBeNull();
      for (const v of [host, projector, member, late]) expect(v.introMs).toBe(INTRO_MS);
    });
  });

  it("holds the reveal time back until REVEALED, then shows the same instant everywhere", () => {
    const h = start([3]);
    walk(h, (phase) => {
      for (const viewer of [HOST, PROJECTOR, player("g1p1")]) {
        const v = view(h, viewer);
        if (phase === "REVEALED") expect(v.revealStartedAt).toBe(h.shared.revealedAt);
        else expect(v.revealStartedAt).toBeNull();
      }
    });
    expect(h.shared.revealedAt).not.toBeNull();
  });

  it("exposes only allow-listed keys and none of the hidden case data, in every phase", () => {
    const h = start([3, 4]);
    walk(h, (phase) => {
      for (const viewer of [HOST, PROJECTOR, player("g1p1"), player("g2p2"), player("late")]) {
        const v = view(h, viewer);
        expect(Object.keys(v).sort(), `${phase} keys`).toEqual(VIEW_KEYS);
        const text = JSON.stringify(v);
        for (const word of FORBIDDEN)
          expect(text, `${phase} ${viewer.kind} ${word}`).not.toContain(`"${word}"`);
        expect(text).not.toContain(h.shared.caseData.familyId + "/");
        expect(text).not.toContain(h.shared.caseData.variantId);
      }
    });
  });

  it("keeps the intro descriptor free of weapons, answers' method and violent words", () => {
    const h = start([3]);
    h.host("mm:start");
    for (const viewer of [HOST, PROJECTOR]) {
      const intro = view(h, viewer).intro!;
      const text = JSON.stringify(intro).toLowerCase();
      for (const weapon of h.shared.caseData.briefing.weapons) {
        expect(text).not.toContain(weapon.name.toLowerCase());
        expect(text).not.toContain(weapon.id);
      }
      for (const term of INTRO_BANNED_TERMS) expect(text).not.toMatch(new RegExp(`\\b${term}\\b`));
      expect(Object.keys(intro.roomShapes).sort()).toEqual(
        view(h, viewer)
          .briefing!.rooms.map((r) => r.id)
          .sort(),
      );
    }
  });

  it("shows a player only the cards assigned to them while sharing", () => {
    const h = start([3, 4]);
    walk(h, (phase) => {
      if (phase !== "SHARING") return;
      const logic = h.shared.caseData.logic;
      const seen: string[] = [];
      for (const id of team(h).members) {
        const own = view(h, player(id)).ownTeam!;
        expect(own.myCards.map((c) => c.id).sort()).toEqual(
          Object.entries(team(h).owners)
            .filter(([, o]) => o === id)
            .map(([c]) => c)
            .sort(),
        );
        expect(own.sharedCards).toBeNull();
        expect(own.draft).toBeNull();
        seen.push(...own.myCards.map((c) => c.id));
        const text = JSON.stringify(view(h, player(id)));
        for (const card of logic.cards) {
          const face = h.shared.caseData.cards[card.id]!;
          if (!own.myCards.some((c) => c.id === card.id)) expect(text).not.toContain(face.body);
        }
      }
      expect(seen.sort()).toEqual([...logic.initialCardIds].sort());
    });
  });

  it("hides every clue, draft, answer and score from the projector", () => {
    const h = start([3, 4]);
    const routes = [0, 1].map(() => allRoutes(h.shared.caseData.logic)[0]!);
    playAll(h, routes);
    const v = view(h, PROJECTOR);
    const text = JSON.stringify(v);
    for (const face of Object.values(h.shared.caseData.cards))
      expect(text).not.toContain(face.body);
    expect(v.ownTeam).toBeNull();
    expect(v.hostDetails).toBeNull();
    expect(v.reveal).toBeNull();
    expect(v.results).toBeNull();
    expect(v.progress).toEqual([
      { groupId: "g1", active: true, acted: false, submitted: true },
      { groupId: "g2", active: true, acted: false, submitted: true },
    ]);
  });
});

describe("investigation view", () => {
  it("offers labels only, lets only the lead act, and keeps new clues with the lead", () => {
    const h = start([4]);
    toInvestigation(h);
    const lead = leadOf(h);
    const peer = team(h).members.find((m) => m !== lead)!;
    const leadView = view(h, player(lead)).ownTeam!;
    const peerView = view(h, player(peer)).ownTeam!;
    expect(leadView.leadId).toBe(lead);
    expect(peerView.leadId).toBe(lead);
    expect(leadView.canInvestigate).toBe(true);
    expect(peerView.canInvestigate).toBe(false);
    expect(leadView.options.length).toBeGreaterThanOrEqual(1);
    for (const option of leadView.options) {
      expect(Object.keys(option).sort()).toEqual([
        "evidence",
        "id",
        "kind",
        "prompt",
        "targetId",
        "targetLabel",
      ]);
      for (const e of option.evidence) expect(Object.keys(e).sort()).toEqual(["id", "label"]);
    }
    expect(JSON.stringify(leadView)).not.toMatch(/resultCardIds|requiredCardIds|candidates/);

    const route = allRoutes(h.shared.caseData.logic)[0]!;
    const action = h.shared.caseData.logic.actions.find((a) => a.id === route[0])!;
    h.player(lead, "mm:investigate", { round: 1, actionId: route[0] });
    const after = view(h, player(lead)).ownTeam!;
    expect(after.canInvestigate).toBe(false);
    expect(after.history).toEqual([{ round: 1, label: action.prompt }]);
    expect(after.myCards.length).toBe(
      Object.values(team(h).owners).filter((o) => o === lead).length,
    );
    const peerText = JSON.stringify(view(h, player(peer)));
    for (const id of action.resultCardIds) {
      expect(peerText).not.toContain(h.shared.caseData.cards[id]!.body);
    }
    expect(view(h, player(peer)).ownTeam!.history).toHaveLength(1);
    expect(view(h, PROJECTOR).progress[0]!.acted).toBe(true);
  });

  it("locks the lead out while paused", () => {
    const h = start([3]);
    toInvestigation(h);
    h.host("mm:pause");
    expect(view(h, player(leadOf(h))).ownTeam!.canInvestigate).toBe(false);
    expect(view(h, player(leadOf(h))).paused).toBe(true);
  });
});

describe("conclusion and reveal views", () => {
  it("shares each team's own discoveries in the conclusion and nobody else's", () => {
    const h = start([3, 3]);
    const logic = h.shared.caseData.logic;
    const routes = allRoutes(logic);
    const first = routes[0]!;
    const second = routes.find(
      (r) => new Set(r).size === 4 && [...r].sort().join() !== [...first].sort().join(),
    )!;
    toInvestigation(h);
    for (let round = 1; round <= 4; round++) {
      h.player(team(h).leadOrder[round - 1]!, "mm:investigate", {
        round,
        actionId: first[round - 1],
      });
      h.player(team(h, "g2").leadOrder[round - 1]!, "mm:investigate", {
        round,
        actionId: second[round - 1],
      });
      h.host("mm:next");
    }
    const member = team(h).members[0]!;
    const own = view(h, player(member)).ownTeam!;
    expect(own.sharedCards!.map((c) => c.id).sort()).toEqual(cardsAfter(logic, first).sort());
    const onlyOther = cardsAfter(logic, second).filter(
      (c) => !cardsAfter(logic, first).includes(c),
    );
    const text = JSON.stringify(view(h, player(member)));
    for (const id of onlyOther) expect(text).not.toContain(h.shared.caseData.cards[id]!.body);
    expect(own.draft).toEqual(team(h).draft);
  });

  it("lets only the submitter edit, and confirm only a complete draft", () => {
    const h = start([4]);
    const route = allRoutes(h.shared.caseData.logic)[0]!;
    toInvestigation(h);
    for (let round = 1; round <= 4; round++) {
      h.player(team(h).leadOrder[round - 1]!, "mm:investigate", {
        round,
        actionId: route[round - 1],
      });
      h.host("mm:next");
    }
    const submitter = team(h).leadOrder[3]!;
    const other = team(h).members.find((m) => m !== submitter)!;
    expect(view(h, player(submitter)).ownTeam).toMatchObject({
      canEdit: true,
      canSubmit: false,
      submitterId: submitter,
    });
    expect(view(h, player(other)).ownTeam).toMatchObject({ canEdit: false, canSubmit: false });
    h.player(submitter, "mm:saveDraft", { draftVersion: 0, conclusion: conclusionFor(h, route) });
    expect(view(h, player(submitter)).ownTeam).toMatchObject({
      canEdit: true,
      canSubmit: true,
      draftVersion: 1,
    });
    h.player(submitter, "mm:submit", { draftVersion: 1 });
    expect(view(h, player(submitter)).ownTeam).toMatchObject({ canEdit: false, canSubmit: false });
    expect(view(h, player(other)).ownTeam!.submission).toEqual(conclusionFor(h, route));
  });

  it("returns no result or answer to anyone, even the submitting team, until Reveal", () => {
    const h = start([3, 3]);
    const route = allRoutes(h.shared.caseData.logic)[0]!;
    playAll(h, [route, route]);
    h.host("mm:next");
    expect(h.shared.phase).toBe("AWAITING_REVEAL");
    for (const viewer of [HOST, PROJECTOR, player("g1p1"), player("g2p1")]) {
      const v = view(h, viewer);
      expect(v.reveal).toBeNull();
      expect(v.results).toBeNull();
    }
    h.host("mm:reveal");
    for (const viewer of [HOST, PROJECTOR, player("g1p1"), player("late")]) {
      const v = view(h, viewer);
      expect(v.reveal).toEqual(h.shared.caseData.reveal);
      expect(v.results!.map((r) => [r.groupId, r.rank, r.score.total])).toEqual([
        ["g1", 1, 10],
        ["g2", 1, 10],
      ]);
    }
  });

  it("gives the host the whole case and nobody else", () => {
    const h = start([3]);
    const host = view(h, HOST);
    expect(host.hostDetails!.solution).toEqual(h.shared.caseData.reveal);
    expect(host.hostDetails!.cards.map((c) => c.id).sort()).toEqual(
      Object.keys(h.shared.caseData.cards).sort(),
    );
    expect(host.hostDetails!.teams[0]!.owners).toEqual(team(h).owners);
    expect(view(h, player("g1p1")).hostDetails).toBeNull();
    expect(view(h, PROJECTOR).hostDetails).toBeNull();
  });
});

describe("people who are not on a team", () => {
  it("gives a late joiner, a rejoiner with a new id and a removed player a public-only view", () => {
    const h = start([3, 4]);
    walk(h, () => undefined);
    const h2 = start([3, 4]);
    toInvestigation(h2);
    h2.leave("g1p2");
    for (const viewer of [player("late"), player("g1p2"), player("g1p2-rejoined")]) {
      const v = view(h2, viewer, "g1");
      expect(v.ownTeam, viewer.kind === "player" ? viewer.playerId : "").toBeNull();
      expect(v.hostDetails).toBeNull();
      expect(v.briefing).not.toBeNull();
      const text = JSON.stringify(v);
      for (const face of Object.values(h2.shared.caseData.cards))
        expect(text).not.toContain(face.body);
    }
    expect(h2.player("late", "mm:investigate", { round: 1, actionId: "x" })).toBe(false);
  });
});
