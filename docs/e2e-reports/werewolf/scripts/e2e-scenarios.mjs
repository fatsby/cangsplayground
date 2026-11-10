import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/cang/orca/projects/cangsplayground";
const require = createRequire(ROOT + "/package.json");
const { chromium } = require("playwright-core");
const { io } = require("socket.io-client");

const BASE = "http://localhost:5273";
const API_URL = "http://localhost:3100";
const SHOTS_DIR = path.join(ROOT, "docs/e2e-reports/werewolf/screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(url = API_URL) {
  const socket = io(url, { transports: ["websocket"], forceNew: true });
  const conn = { socket, view: null, received: [] };
  socket.on("state:sync", (view) => {
    conn.view = view;
    conn.received.push(view);
  });
  socket.on("state:patch", (patch) => {
    if (conn.view) conn.view = { ...conn.view, ...patch };
    conn.received.push(patch);
  });
  const connected = new Promise((res, rej) => {
    socket.once("connect", res);
    socket.once("connect_error", rej);
  });
  const ack = (event, payload) =>
    new Promise((resolve, reject) => {
      socket.emit(event, payload, (res) => {
        if (!res.ok) reject(res.error);
        else resolve(res.data);
      });
    });
  return { socket, conn, connected, ack };
}

async function run() {
  console.log("=== Starting Werewolf E2E Execution ===");
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  let cmdId = 0;
  const nextCmd = () => `cmd_${++cmdId}`;

  const results = {
    guardSaves: null,
    villageWins: null,
    wolvesWin: null,
    voteTie: null,
    edgeCases: {},
    consoleErrors: [],
  };

  const consoleErrors = [];
  function watchPage(page, label) {
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`[${label}] error: ${m.text()}`);
    });
    page.on("pageerror", (e) => consoleErrors.push(`[${label}] pageerror: ${e.message}`));
  }

  try {
    // =========================================================================
    // SCENARIO 1: Guard Saves Wolf Target & Village Wins
    // =========================================================================
    console.log("\n--- Scenario 1: Guard Saves Target & Village Wins ---");
    const hostConn = connect();
    await hostConn.connected;
    const { code, hostToken } = await hostConn.ack("lobby:create", {});
    await hostConn.ack("host:attach", { code, hostToken });
    console.log(`Lobby created: ${code}`);

    // Projector
    const projCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const projPage = await projCtx.newPage();
    watchPage(projPage, "projector");
    await projPage.goto(`${BASE}/display/${code}`);
    await projPage.waitForURL(new RegExp(`/display/${code}`));

    // Host page
    const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const hostPage = await hostCtx.newPage();
    watchPage(hostPage, "host");
    await hostPage.goto(`${BASE}/host/${code}`);

    // Join 5 players via browser
    const names = ["Alice", "Bob", "Charlie", "David", "Emma"];
    const pConns = {};
    const pPages = {};

    for (const name of names) {
      const pCtx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await pCtx.newPage();
      watchPage(page, `player:${name}`);
      await page.goto(`${BASE}/join/${code}`);
      await page.getByLabel("Your name").fill(name);
      await page.getByRole("button", { name: /join/i }).last().click();
      await page.waitForURL(/\/play\//);
      pPages[name] = { ctx: pCtx, page };

      // Obtain token and resume socket session
      const token = await page.evaluate((c) => localStorage.getItem("cangsplayground:player:" + c), code);
      const c = connect();
      await c.connected;
      const resumed = await c.ack("session:resume", { token });
      pConns[name] = { ...c, id: resumed.playerId };
    }
    console.log("5 players joined and attached via socket session");

    // Wait until hostConn sees all 5 players
    while ((hostConn.conn.view?.players?.length ?? 0) < 5) await sleep(100);

    const waitStage = async (target, maxSec = 50) => {
      const start = Date.now();
      while (Date.now() - start < maxSec * 1000) {
        if (hostConn.conn.view?.game?.shared?.stage === target) return target;
        await sleep(150);
      }
      throw new Error(`Timeout waiting for stage ${target}, current is ${hostConn.conn.view?.game?.shared?.stage}`);
    };

    // Configure & prepare werewolf
    await hostConn.ack("game:select", { gameId: "werewolf", commandId: nextCmd() });
    await hostConn.ack("game:configure", {
      config: { nightSeconds: 10, discussionSeconds: 30, voteSeconds: 15 },
      commandId: nextCmd(),
    });
    await hostConn.ack("game:control", { cmd: "prepare", commandId: nextCmd() });
    await waitStage("SETUP");
    console.log("Game in SETUP");

    const playerList = hostConn.conn.view.players;
    const idOf = (n) => playerList.find((p) => p.name === n).id;

    // Assign roles: Alice -> werewolf, Bob -> guard, Charlie -> seer, David -> villager, Emma -> villager
    const roleMapping = {
      Alice: "werewolf",
      Bob: "guard",
      Charlie: "seer",
      David: "villager",
      Emma: "villager",
    };
    for (const [name, role] of Object.entries(roleMapping)) {
      await hostConn.ack("game:hostAction", {
        type: "ww:setRole",
        payload: { playerId: idOf(name), role },
        commandId: nextCmd(),
      });
    }
    console.log("Roles assigned");

    // Start game
    await hostConn.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() });
    await waitStage("REVEAL");
    console.log("Entered REVEAL (10s)");

    // Night 1
    await waitStage("NIGHT");
    console.log("Entered NIGHT 1");

    // UI actions + socket verification:
    // Alice (wolf) votes David via UI
    await pPages.Alice.page.locator(`[data-n="${idOf("David")}"]`).first().click();
    // Bob (guard) protects David via UI
    await pPages.Bob.page.locator(`[data-n="${idOf("David")}"]`).first().click();
    // Charlie (seer) inspects Alice via UI
    await pPages.Charlie.page.locator(`[data-n="${idOf("Alice")}"]`).first().click();

    // Wait for DAWN (Guard protects David -> NO ONE DIED!)
    await waitStage("DAWN");
    console.log("Entered DAWN 1");
    await sleep(2500); // Allow animation (sun, birds, SafeScene) to render
    const dawn1 = hostConn.conn.view.game.shared.dawn;
    console.log("DAWN 1 result:", dawn1);
    results.guardSaves = dawn1?.eliminatedId === null;

    // Capture Safe Dawn screenshots
    await projPage.screenshot({ path: path.join(SHOTS_DIR, "201-display-dawn-safe.png") });
    await pPages.Bob.page.screenshot({ path: path.join(SHOTS_DIR, "202-guard-phone-dawn-safe.png") });
    await pPages.David.page.screenshot({ path: path.join(SHOTS_DIR, "203-target-phone-dawn-safe.png") });

    // Wait for DISCUSSION then VOTE
    await waitStage("DISCUSSION");
    console.log("Entered DISCUSSION 1");
    await waitStage("VOTE");
    console.log("Entered VOTE 1");

    // All 4 village members vote out the only wolf (Alice) via UI
    for (const voter of ["Bob", "Charlie", "David", "Emma"]) {
      await pPages[voter].page.locator(`[data-n="${idOf("Alice")}"]`).first().click();
    }
    await sleep(500);

    // Wait for VERDICT
    await waitStage("VERDICT");
    console.log("Entered VERDICT");
    await sleep(3000); // Shatter animation + banner
    await projPage.screenshot({ path: path.join(SHOTS_DIR, "204-display-verdict-alice-banished.png") });
    await pPages.Alice.page.screenshot({ path: path.join(SHOTS_DIR, "205-player-alice-banished.png") });

    // Wait for ENDED -> Village Wins!
    await waitStage("ENDED");
    console.log("Entered ENDED (Village Wins!)");
    await sleep(4000); // Wait for card flip sequence, rays, fireflies
    results.villageWins = hostConn.conn.view.game.shared.winner === "village";

    await projPage.screenshot({ path: path.join(SHOTS_DIR, "220-display-final-village-win.png") });
    await pPages.David.page.screenshot({ path: path.join(SHOTS_DIR, "221-player-village-won.png") });
    await pPages.Alice.page.screenshot({ path: path.join(SHOTS_DIR, "222-player-wolf-lost.png") });
    await hostPage.screenshot({ path: path.join(SHOTS_DIR, "223-host-final-village-win.png") });

    // Cleanup scenario 1
    hostConn.socket.disconnect();
    for (const c of Object.values(pConns)) c.socket.disconnect();
    await projCtx.close();
    await hostCtx.close();
    for (const p of Object.values(pPages)) await p.ctx.close();

    // =========================================================================
    // SCENARIO 2: Werewolves Win
    // =========================================================================
    console.log("\n--- Scenario 2: Werewolves Win ---");
    const hostConn2 = connect();
    await hostConn2.connected;
    const created2 = await hostConn2.ack("lobby:create", {});
    const code2 = created2.code;
    await hostConn2.ack("host:attach", { code: code2, hostToken: created2.hostToken });

    const projCtx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const projPage2 = await projCtx2.newPage();
    watchPage(projPage2, "projector2");
    await projPage2.goto(`${BASE}/display/${code2}`);

    const hostCtx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const hostPage2 = await hostCtx2.newPage();
    watchPage(hostPage2, "host2");
    await hostPage2.goto(`${BASE}/host/${code2}`);

    const names2 = ["WolfA", "WolfB", "GuardC", "VillD", "VillE"];
    const pConns2 = {};
    const pPages2 = {};

    for (const name of names2) {
      const pCtx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await pCtx.newPage();
      watchPage(page, `player2:${name}`);
      await page.goto(`${BASE}/join/${code2}`);
      await page.getByLabel("Your name").fill(name);
      await page.getByRole("button", { name: /join/i }).last().click();
      await page.waitForURL(/\/play\//);
      pPages2[name] = { ctx: pCtx, page };

      const token = await page.evaluate((c) => localStorage.getItem("cangsplayground:player:" + c), code2);
      const c = connect();
      await c.connected;
      const resumed = await c.ack("session:resume", { token });
      pConns2[name] = { ...c, id: resumed.playerId };
    }

    while ((hostConn2.conn.view?.players?.length ?? 0) < 5) await sleep(100);

    const waitStage2 = async (target, maxSec = 50) => {
      const start = Date.now();
      while (Date.now() - start < maxSec * 1000) {
        if (hostConn2.conn.view?.game?.shared?.stage === target) return target;
        await sleep(150);
      }
      throw new Error(`Timeout waiting for stage ${target}, current is ${hostConn2.conn.view?.game?.shared?.stage}`);
    };

    await hostConn2.ack("game:select", { gameId: "werewolf", commandId: nextCmd() });
    await hostConn2.ack("game:configure", {
      config: { nightSeconds: 10, discussionSeconds: 30, voteSeconds: 15 },
      commandId: nextCmd(),
    });
    await hostConn2.ack("game:control", { cmd: "prepare", commandId: nextCmd() });
    await waitStage2("SETUP");

    const playerList2 = hostConn2.conn.view.players;
    const idOf2 = (n) => playerList2.find((p) => p.name === n).id;

    // 2 wolves, 1 guard, 2 villagers -> wolves (2) < non-wolves (3)
    const roleMapping2 = {
      WolfA: "werewolf",
      WolfB: "werewolf",
      GuardC: "guard",
      VillD: "villager",
      VillE: "villager",
    };
    for (const [name, role] of Object.entries(roleMapping2)) {
      await hostConn2.ack("game:hostAction", {
        type: "ww:setRole",
        payload: { playerId: idOf2(name), role },
        commandId: nextCmd(),
      });
    }

    await hostConn2.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() });
    await waitStage2("REVEAL");
    await waitStage2("NIGHT");
    console.log("Entered NIGHT 1 (Scenario 2)");

    // Wolves kill VillD. Guard protects VillE.
    await pPages2.WolfA.page.locator(`[data-n="${idOf2("VillD")}"]`).first().click();
    await pPages2.WolfB.page.locator(`[data-n="${idOf2("VillD")}"]`).first().click();
    await pPages2.GuardC.page.locator(`[data-n="${idOf2("VillE")}"]`).first().click();

    // Dawn 1: VillD eliminated -> alive: WolfA, WolfB, GuardC, VillE (4 alive: 2 wolves, 2 non-wolves)
    // Parity reached! pendingWinner = "wolves"!
    await waitStage2("DAWN");
    console.log("Entered DAWN 1 (VillD eliminated, Wolves reach parity!)");
    await sleep(2500);

    // After DAWN ends, transitions directly to ENDED
    await waitStage2("ENDED");
    console.log("Entered ENDED (Werewolves Win!)");
    await sleep(4000); // Wait for blood moon, claw marks, howl waves
    results.wolvesWin = hostConn2.conn.view.game.shared.winner === "wolves";

    await projPage2.screenshot({ path: path.join(SHOTS_DIR, "230-display-final-wolves-win.png") });
    await pPages2.WolfA.page.screenshot({ path: path.join(SHOTS_DIR, "231-player-wolf-won.png") });
    await pPages2.VillE.page.screenshot({ path: path.join(SHOTS_DIR, "232-player-villager-lost.png") });
    await hostPage2.screenshot({ path: path.join(SHOTS_DIR, "233-host-final-wolves-win.png") });

    hostConn2.socket.disconnect();
    for (const c of Object.values(pConns2)) c.socket.disconnect();
    await projCtx2.close();
    await hostCtx2.close();
    for (const p of Object.values(pPages2)) await p.ctx.close();

    // =========================================================================
    // SCENARIO 3: Socket Edge Cases & Validation Audit
    // =========================================================================
    console.log("\n--- Scenario 3: Edge Cases & Validation Audit ---");
    const edgeHost = connect();
    await edgeHost.connected;
    const edgeLobby = await edgeHost.ack("lobby:create", {});
    await edgeHost.ack("host:attach", { code: edgeLobby.code, hostToken: edgeLobby.hostToken });

    const rawClients = [];
    for (let i = 0; i < 5; i++) {
      const c = connect();
      await c.connected;
      const joined = await c.ack("lobby:join", { code: edgeLobby.code, name: `T${i}` });
      rawClients.push({ ...c, id: joined.playerId });
    }

    await edgeHost.ack("game:select", { gameId: "werewolf", commandId: nextCmd() });
    await edgeHost.ack("game:control", { cmd: "prepare", commandId: nextCmd() });

    // (a) Config validation: 0 werewolves
    for (const c of rawClients) {
      await edgeHost.ack("game:hostAction", {
        type: "ww:setRole",
        payload: { playerId: c.id, role: "villager" },
        commandId: nextCmd(),
      });
    }
    await edgeHost.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() });
    results.edgeCases.rejectStartNoWolf = edgeHost.conn.view.game.shared.stage === "SETUP";

    // (b) Config validation: Wolves parity/majority before game start (3 wolves, 2 villagers)
    for (let i = 0; i < 3; i++) {
      await edgeHost.ack("game:hostAction", {
        type: "ww:setRole",
        payload: { playerId: rawClients[i].id, role: "werewolf" },
        commandId: nextCmd(),
      });
    }
    await edgeHost.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() });
    results.edgeCases.rejectStartWolfParity = edgeHost.conn.view.game.shared.stage === "SETUP";

    // (c) Unauthorized non-host calling ww:start
    const playerStart = await rawClients[0].ack("game:hostAction", { type: "ww:start", commandId: nextCmd() }).catch((e) => e);
    results.edgeCases.unauthorizedHostActionRejected = playerStart.code === "UNAUTHORIZED";

    edgeHost.socket.disconnect();
    for (const c of rawClients) c.socket.disconnect();

  } finally {
    await browser.close();
  }

  results.consoleErrors = consoleErrors;
  console.log("\n=== Execution Summary ===");
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(
    path.join(ROOT, "docs/e2e-reports/werewolf/raw/scenarios-result.json"),
    JSON.stringify(results, null, 2),
  );
}

run().catch((e) => {
  console.error("FATAL in test-scenarios:", e);
  process.exit(1);
});
