// Full classroom acceptance against the production build; no extra test framework.
// pnpm build
// pnpm --filter @cangsplayground/server exec tsx ../../scripts/acceptance-murder-mystery.mjs [output-dir]
// Requires Chromium: pnpm exec playwright-core install chromium.
// API setup creates teams/case; every game control, investigation and submission uses browser UI.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { io } from "socket.io-client";
import { createServer } from "../apps/server/src/index.ts";
import { LobbyManager } from "../apps/server/src/lobby/LobbyManager.ts";
import { availableActions, proofSets } from "../packages/games/murder-mystery/src/index.ts";

const out = resolve(process.argv[2] ?? "/tmp/cangsplayground-murder-mystery") + "/";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const servers = [],
  sockets = [];

const track = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const until = async (check, label) => {
  const end = Date.now() + 16000;
  while (!check()) {
    if (Date.now() > end) throw Error("Timed out: " + label);
    await new Promise((r) => setTimeout(r, 20));
  }
};
const expectVisible = (locator) => locator.waitFor({ state: "visible", timeout: 8000 });
const checkWidth = async (p) =>
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "horizontal overflow",
  );
const newPage = async (opts = {}) => {
  const c = await browser.newContext(opts);
  c.setDefaultTimeout(6000);
  return track(await c.newPage());
};
function preview(seed) {
  const lobby = new LobbyManager({ seed }).create();
  for (let i = 0; i < 7; i++) lobby.join(`Student ${i}`);
  lobby.selectGame("murder-mystery");
  lobby.assign("count", 2);
  lobby.control("prepare");
  return lobby.game.shared.caseData.sceneId;
}
const firstSeed = 3;
const secondSeed = Array.from({ length: 20 }, (_, i) => i + 4).find(
  (s) => preview(s) !== preview(firstSeed),
);
assert(secondSeed);
const report = [];
try {
  for (const [run, seed] of [firstSeed, secondSeed].entries()) {
    const server = await createServer({ seed, production: true, publicUrl: "http://127.0.0.1" });
    servers.push(server);
    console.log("SERVER", seed);
    const base = await server.listen(0, "127.0.0.1");
    const socket = io(base, { transports: ["websocket"] });
    sockets.push(socket);
    await new Promise((r) => socket.once("connect", r));
    let commands = 0;
    const ack = (event, payload) =>
      new Promise((resolve, reject) =>
        socket
          .timeout(8000)
          .emit(event, payload, (err, res) =>
            err
              ? reject(err)
              : res.ok
                ? resolve(res.data)
                : reject(Error(event + ": " + res.error.message)),
          ),
      );
    let hview;
    socket.on("state:sync", (v) => (hview = v));
    socket.on("state:patch", (p) => (hview = { ...hview, ...p }));
    const { code, hostToken } = await ack("lobby:create", {});
    await ack("host:attach", { code, hostToken });
    const lobby = server.manager.get(code),
      state = () => lobby.game.shared;
    const projector = await newPage({ viewport: { width: 1440, height: 810 } });
    await projector.goto(base + "/display/" + code);
    const host = await newPage({ viewport: { width: 390, height: 844 } });
    await host
      .context()
      .addInitScript(
        ({ code, hostToken }) => localStorage.setItem(`cangsplayground:host:${code}`, hostToken),
        { code, hostToken },
      );
    const phones = [];
    for (let i = 0; i < 7; i++) {
      const p = await newPage({
        viewport: { width: 320, height: 720 },
        isMobile: true,
        hasTouch: true,
      });
      await p.goto(base + "/join/" + code);
      await p.getByLabel("Your name").fill(`Student ${i}`);
      await p.getByRole("button", { name: /join/i }).last().click();
      await p.waitForURL("**/play/" + code);
      phones.push(p);
      console.log("JOINED", i);
    }
    const playerPage = (id) => phones[[...lobby.players.values()].findIndex((p) => p.id === id)];
    await ack("groups:assign", { mode: "count", value: 2, commandId: `a${++commands}` });
    await ack("game:select", { gameId: "murder-mystery", commandId: `a${++commands}` });
    await ack("game:control", { cmd: "prepare", commandId: `a${++commands}` });
    const c = state().caseData;
    assert.equal(c.sceneId, preview(seed));
    await host.goto(base + "/host/" + code);
    await host.getByRole("button", { name: "Start", exact: true }).click();
    await expectVisible(projector.locator(".mm-intro"));
    await expectVisible(phones[0].getByText("Watch the projector", { exact: true }));
    await host.getByRole("button", { name: "Pause", exact: true }).click();
    await until(() => state().paused, "intro paused");
    await projector.reload();
    await expectVisible(projector.locator(".mm-intro"));
    const frozen = state().clock.remainingMs;
    assert(frozen > 0 && frozen < 13000);
    await projector.getByRole("button", { name: "Enter fullscreen" }).click();
    await projector.waitForFunction(() => !!document.fullscreenElement);
    await projector.emulateMedia({ reducedMotion: "reduce" });
    await expectVisible(projector.locator(".mm-intro-title h1"));
    assert.equal(await projector.locator(".mm-intro-title h1").innerText(), c.briefing.title);
    assert.equal(await projector.locator('[data-part="title"]').getAttribute("data-pending"), null);
    await projector.evaluate(() => document.fonts.ready);
    const boxes = await projector.evaluate(() =>
      [".mm-intro-title", ".mm-intro-question", ".mm-caption"].map((s) => {
        const b = document.querySelector(s).getBoundingClientRect();
        return { top: b.top, bottom: b.bottom };
      }),
    );
    assert(
      boxes[0].bottom < boxes[1].top && boxes[1].bottom < boxes[2].top,
      "intro overlays remain separate: " + JSON.stringify(boxes),
    );
    await projector.screenshot({ path: out + `intro-${c.sceneId}.png` });
    assert.equal(state().clock.remainingMs, frozen);
    await projector.emulateMedia({ reducedMotion: "no-preference" });
    await host.getByRole("button", { name: "Resume", exact: true }).click();
    if (run === 1) await host.getByRole("button", { name: "Skip intro", exact: true }).click();
    await until(() => state().phase === "BRIEFING", "natural intro or skip");
    assert.equal(state().clock.durationMs, 120000);
    const advance = async () => {
      const version = state().phaseVersion;
      await host.getByRole("button", { name: "Next", exact: true }).click();
      await host.getByRole("button", { name: "Yes, move on", exact: true }).click();
      await until(() => state().phaseVersion > version, "phase advanced");
    };
    await advance();
    console.log("SHARING");
    const owner = state().teams[0].members[0];
    const own = playerPage(owner);
    await expectVisible(
      own.getByRole("region", { name: "Your clues" }).or(own.locator(".mm-private")),
    );
    const secret = own.getByRole("button", { name: /hold/i }).first();
    await expectVisible(secret);
    await own.bringToFront();
    await secret.hover();
    await own.mouse.down();
    await expectVisible(own.locator(".mm-clue-body").first());
    const privateText = await own.locator(".mm-clue-body").first().innerText();
    await own.mouse.up();
    await own.reload();
    await expectVisible(own.getByRole("button", { name: /hold/i }).first());
    assert.equal(await own.locator(".mm-clue-body").count(), 0, "reload conceals clues");
    assert(
      !(await projector
        .locator("body")
        .innerText()
        .then((t) => t.includes(privateText))),
    );
    await advance();
    console.log("INVESTIGATION");
    // Reload during a turn, then disconnect the current lead and transfer through host UI.
    let t = state().teams[0];
    const old = t.leadOrder[0],
      oldPage = playerPage(old),
      oldIndex = phones.indexOf(oldPage);
    await oldPage.reload();
    await expectVisible(oldPage.getByRole("heading", { name: "You lead Round 1" }));
    await oldPage.context().close();
    await until(() => !state().teams[0].connected.includes(old), "lead offline");
    const target = state().teams[0].connected[0];
    const group = lobby.groups.find((g) => g.id === t.groupId);
    await host.getByLabel(`Move from, ${group.name}`).selectOption(old);
    await host.getByLabel(`Move to, ${group.name}`).selectOption(target);
    await host
      .locator(".mm-host-team")
      .filter({ hasText: group.name })
      .getByRole("button", { name: "Reassign", exact: true })
      .click();
    await until(() => state().teams[0].leadOrder[0] === target, "lead transferred");
    // Restore the old browser identity for public-only observation of the new lead.
    const restored = await newPage({
      viewport: { width: 320, height: 720 },
      isMobile: true,
      hasTouch: true,
    });
    await restored
      .context()
      .addInitScript(
        ({ code, token }) => localStorage.setItem(`cangsplayground:player:${code}`, token),
        { code, token: lobby.players.get(old).token },
      );
    await restored.goto(base + "/play/" + code);
    phones[oldIndex] = restored;
    const routes = [];
    function walk(used) {
      const known = [
        ...c.logic.initialCardIds,
        ...used.flatMap((id) => c.logic.actions.find((a) => a.id === id).resultCardIds),
      ];
      if (used.length === 4) {
        routes.push(used);
        return;
      }
      for (const a of availableActions(c.logic, used, known)) walk([...used, a.id]);
    }
    walk([]);
    const first = routes[0],
      second = routes.find((r) => [...r].sort().join() !== [...first].sort().join()) ?? first;
    const chosen = [first, second];
    for (let round = 1; round <= 4; round++) {
      for (const [i, team] of state().teams.entries()) {
        const p = playerPage(team.leadOrder[round - 1]);
        await expectVisible(p.getByRole("heading", { name: `You lead Round ${round}` }));
        const action = c.logic.actions.find((a) => a.id === chosen[i][round - 1]);
        const option = p.locator(".mm-option").filter({ hasText: action.prompt });
        await option.evaluate((el) => (el.closest("details").open = true));
        await option.click();
        await p.getByRole("button", { name: "Yes, investigate", exact: true }).click();
        await expectVisible(p.getByRole("heading", { name: "Your team has asked" }));
        const held = p.getByRole("button", { name: /hold/i }).last();
        await p.bringToFront();
        await held.hover();
        await p.mouse.down();
        await expectVisible(p.locator(".mm-clue-body").last());
        await checkWidth(p);
        if (run === 0 && round === 1 && i === 0)
          await p.screenshot({ path: out + "phone-investigation.png", fullPage: true });
        await p.mouse.up();
      }
      await advance();
    }
    assert.equal(state().phase, "CONCLUSION");
    console.log("CONCLUSION");
    for (const [i, team] of state().teams.entries()) {
      const p = playerPage(team.leadOrder[3]);
      const known = [
        ...c.logic.initialCardIds,
        ...chosen[i].flatMap((id) => c.logic.actions.find((a) => a.id === id).resultCardIds),
      ];
      for (const [field, legend, list] of [
        ["suspectId", "Who did it?", "suspects"],
        ["weaponId", "With what?", "weapons"],
        ["roomId", "Where?", "rooms"],
      ]) {
        const name = c.briefing[list].find((e) => e.id === c.reveal.answer[field]).name;
        await p
          .getByRole("group", { name: `${legend} answer`, exact: true })
          .getByRole("button", { name, exact: true })
          .click();
        for (const id of proofSets(c.logic, known, field)[0])
          await p
            .getByRole("group", { name: `${legend} evidence`, exact: true })
            .locator(`[data-clue="${id}"]`)
            .click();
      }
      await p.getByRole("button", { name: "Save draft", exact: true }).click();
      await p.getByRole("button", { name: "Review and submit", exact: true }).click();
      await p.getByRole("button", { name: "Yes, submit", exact: true }).click();
      await expectVisible(p.getByRole("heading", { name: "Submitted", exact: true }));
      await checkWidth(p);
    }
    await advance();
    assert.equal(hview.game.shared.results, null);
    await host.getByRole("button", { name: "Reveal", exact: true }).click();
    await until(() => state().phase === "REVEALED", "revealed");
    console.log("REVEALED");
    await expectVisible(projector.getByRole("region", { name: "The solution", exact: true }));
    assert.deepEqual(
      hview.game.shared.results.map((r) => r.score.total),
      [10, 10],
    );
    await phones[0].getByRole("tab", { name: "Solution", exact: true }).click();
    await expectVisible(phones[0].getByRole("region", { name: "The solution", exact: true }));
    await phones[0].getByRole("tab", { name: "Scoreboard", exact: true }).click();
    await projector.emulateMedia({ reducedMotion: "reduce" });
    await expectVisible(projector.getByRole("region", { name: "Scoreboard", exact: true }));
    await projector.emulateMedia({ reducedMotion: "no-preference" });
    await expectVisible(projector.getByRole("region", { name: "The solution", exact: true }));
    await projector
      .getByRole("region", { name: "Scoreboard", exact: true })
      .waitFor({ state: "visible", timeout: 22000 });
    await projector.reload();
    await expectVisible(projector.getByRole("region", { name: "Scoreboard", exact: true }));
    await checkWidth(phones[0]);
    report.push({
      seed,
      caseSeed: c.seed,
      contentVersion: c.contentVersion,
      sceneId: c.sceneId,
      familyId: c.familyId,
      variantId: c.variantId,
      teams: state().teams.map((t) => t.members.length),
      totals: [10, 10],
      checks:
        "7 browser phones at 320px; 1440x810/fullscreen projector; intro pause/resume/reload/reduced motion/natural expiry or skip; private-card hold/reload; offline lead transfer; four rounds; draft/proof submission; shared staged reveal and tabs",
    });
    socket.disconnect();
    for (const context of browser.contexts()) await context.close();
    await server.close();
    console.log("ACCEPTED", JSON.stringify(report.at(-1)));
  }
  assert.deepEqual(errors, [], "browser exceptions");
  await writeFile(out + "acceptance-result.json", JSON.stringify(report, null, 2));
} catch (e) {
  for (const [i, p] of browser
    .contexts()
    .flatMap((c) => c.pages())
    .entries()) {
    console.log(
      "PAGE",
      i,
      p.url(),
      (
        await p
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(-1600),
    );
    await p.screenshot({ path: out + `failure-${i}.png`, fullPage: true }).catch(() => {});
  }
  throw e;
} finally {
  for (const s of sockets) s.disconnect();
  await browser.close();
  for (const s of servers) await s.close().catch(() => {});
}
