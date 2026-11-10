import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/cang/orca/projects/cangsplayground";
const require = createRequire(ROOT + "/package.json");
const { io } = require("socket.io-client");

const API_URL = "http://localhost:3100";
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
  console.log("=== Running Comprehensive Werewolf Edge Cases Suite ===");
  let cmdId = 0;
  const nextCmd = () => `edge_${++cmdId}`;

  const report = {};

  // -------------------------------------------------------------------------
  // 1. Min Player Count Requirement (< 5 players)
  // -------------------------------------------------------------------------
  console.log("Test 1: Minimum player count enforcement");
  const host1 = connect();
  await host1.connected;
  const l1 = await host1.ack("lobby:create", {});
  await host1.ack("host:attach", { code: l1.code, hostToken: l1.hostToken });

  const p1 = [];
  for (let i = 0; i < 4; i++) {
    const c = connect();
    await c.connected;
    const j = await c.ack("lobby:join", { code: l1.code, name: `FourP_${i}` });
    p1.push({ ...c, id: j.playerId });
  }
  while ((host1.conn.view?.players?.length ?? 0) < 4) await sleep(50);

  await host1.ack("game:select", { gameId: "werewolf", commandId: nextCmd() });
  const prepUnder5 = await host1.ack("game:control", { cmd: "prepare", commandId: nextCmd() }).catch((e) => e);
  report.minPlayersEnforced = prepUnder5.code === "GROUPS_TOO_SMALL";
  console.log("Min players enforced (<5 rejected with GROUPS_TOO_SMALL):", report.minPlayersEnforced);
  host1.socket.disconnect();
  for (const c of p1) c.socket.disconnect();

  // -------------------------------------------------------------------------
  // 2. Setup Config Validation: No Wolves, Wolves >= Non-Wolves, Unauthorized Start
  // -------------------------------------------------------------------------
  console.log("Test 2: Setup config validation & authorization");
  const host2 = connect();
  await host2.connected;
  const l2 = await host2.ack("lobby:create", {});
  await host2.ack("host:attach", { code: l2.code, hostToken: l2.hostToken });

  const p2 = [];
  for (let i = 0; i < 5; i++) {
    const c = connect();
    await c.connected;
    const j = await c.ack("lobby:join", { code: l2.code, name: `FiveP_${i}` });
    p2.push({ ...c, id: j.playerId });
  }
  while ((host2.conn.view?.players?.length ?? 0) < 5) await sleep(50);

  await host2.ack("game:select", { gameId: "werewolf", commandId: nextCmd() });
  await host2.ack("game:configure", {
    config: { nightSeconds: 10, discussionSeconds: 30, voteSeconds: 15 },
    commandId: nextCmd(),
  });
  await host2.ack("game:control", { cmd: "prepare", commandId: nextCmd() });
  while (host2.conn.view?.game?.shared?.stage !== "SETUP") await sleep(50);

  // Set all 5 to villager -> 0 wolves
  for (const c of p2) {
    await host2.ack("game:hostAction", {
      type: "ww:setRole",
      payload: { playerId: c.id, role: "villager" },
      commandId: nextCmd(),
    });
  }
  const startNoWolf = await host2.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() }).catch((e) => e);
  report.startRejectedNoWolf = startNoWolf.code === "INVALID_STATE";

  // Set 3 wolves, 2 villagers -> wolves (3) >= non-wolves (2)
  for (let i = 0; i < 3; i++) {
    await host2.ack("game:hostAction", {
      type: "ww:setRole",
      payload: { playerId: p2[i].id, role: "werewolf" },
      commandId: nextCmd(),
    });
  }
  const startWolfParity = await host2.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() }).catch((e) => e);
  report.startRejectedWolfParity = startWolfParity.code === "INVALID_STATE";

  // Unauthorized non-host start
  const unauthorizedStart = await p2[0].ack("game:hostAction", { type: "ww:start", commandId: nextCmd() }).catch((e) => e);
  report.unauthorizedStartRejected = unauthorizedStart.code === "UNAUTHORIZED";

  // Set valid roles: 1 wolf, 1 seer, 1 guard, 2 villagers
  await host2.ack("game:hostAction", { type: "ww:setRole", payload: { playerId: p2[0].id, role: "werewolf" }, commandId: nextCmd() });
  await host2.ack("game:hostAction", { type: "ww:setRole", payload: { playerId: p2[1].id, role: "seer" }, commandId: nextCmd() });
  await host2.ack("game:hostAction", { type: "ww:setRole", payload: { playerId: p2[2].id, role: "guard" }, commandId: nextCmd() });
  await host2.ack("game:hostAction", { type: "ww:setRole", payload: { playerId: p2[3].id, role: "villager" }, commandId: nextCmd() });
  await host2.ack("game:hostAction", { type: "ww:setRole", payload: { playerId: p2[4].id, role: "villager" }, commandId: nextCmd() });

  await host2.ack("game:hostAction", { type: "ww:start", commandId: nextCmd() });
  while (host2.conn.view?.game?.shared?.stage !== "REVEAL") await sleep(50);
  report.validStartAccepted = host2.conn.view?.game?.shared?.stage === "REVEAL";

  console.log("Config validation results:", {
    startRejectedNoWolf: report.startRejectedNoWolf,
    startRejectedWolfParity: report.startRejectedWolfParity,
    unauthorizedStartRejected: report.unauthorizedStartRejected,
    validStartAccepted: report.validStartAccepted,
  });

  // -------------------------------------------------------------------------
  // 3. Night Action Edge Cases: Teammate vote, Self vote, Seer self, Guard self
  // -------------------------------------------------------------------------
  console.log("Test 3: Night action edge cases");
  while (host2.conn.view?.game?.shared?.stage !== "NIGHT") await sleep(100);

  const wolf = p2[0];
  const seer = p2[1];
  const guard = p2[2];
  const villA = p2[3];
  const villB = p2[4];

  // Wolf attempts to vote for self -> rejected
  const wolfSelfVote = await wolf.ack("game:action", { type: "ww:wolfVote", payload: { targetId: wolf.id } }).catch((e) => e);
  report.wolfSelfVoteRejected = wolfSelfVote.code === "INVALID_STATE";

  // Seer attempts to inspect self -> rejected
  const seerSelfInspect = await seer.ack("game:action", { type: "ww:seerPick", payload: { targetId: seer.id } }).catch((e) => e);
  report.seerSelfInspectRejected = seerSelfInspect.code === "INVALID_STATE";

  // Guard protects self -> accepted for first time
  await guard.ack("game:action", { type: "ww:guardPick", payload: { targetId: guard.id } });
  await sleep(200);
  report.guardSelfProtectAcceptedFirstTime = host2.conn.view?.game?.shared?.hostNight?.guardPicks[guard.id] === guard.id;

  // Wolf votes villA
  await wolf.ack("game:action", { type: "ww:wolfVote", payload: { targetId: villA.id } });
  // Seer inspects wolf
  await seer.ack("game:action", { type: "ww:seerPick", payload: { targetId: wolf.id } });

  console.log("Night action results:", {
    wolfSelfVoteRejected: report.wolfSelfVoteRejected,
    seerSelfInspectRejected: report.seerSelfInspectRejected,
    guardSelfProtectAcceptedFirstTime: report.guardSelfProtectAcceptedFirstTime,
  });

  // -------------------------------------------------------------------------
  // 4. Dawn & Dead Player Action Restrictions
  // -------------------------------------------------------------------------
  console.log("Test 4: Dawn kill & dead player action restrictions");
  while (host2.conn.view?.game?.shared?.stage !== "DAWN") await sleep(100);
  report.villAKilled = host2.conn.view?.game?.shared?.dawn?.eliminatedId === villA.id;

  // Advance to VOTE
  while (host2.conn.view?.game?.shared?.stage !== "VOTE") await sleep(100);
  console.log("In VOTE stage. Testing dead player actions.");

  // Dead player (villA) attempts to vote -> rejected
  const deadVote = await villA.ack("game:action", { type: "ww:dayVote", payload: { targetId: wolf.id } }).catch((e) => e);
  report.deadPlayerVoteRejected = deadVote.code === "INVALID_STATE";

  // Living player attempts to vote for dead player -> rejected
  const voteForDead = await wolf.ack("game:action", { type: "ww:dayVote", payload: { targetId: villA.id } }).catch((e) => e);
  report.voteForDeadRejected = voteForDead.code === "INVALID_STATE";

  // Living player attempts to vote for self -> rejected
  const selfVote = await wolf.ack("game:action", { type: "ww:dayVote", payload: { targetId: wolf.id } }).catch((e) => e);
  report.daySelfVoteRejected = selfVote.code === "INVALID_STATE";

  // Rapid duplicate voting: seer changes vote between guard and wolf 5 times rapidly
  for (let i = 0; i < 5; i++) {
    await seer.ack("game:action", { type: "ww:dayVote", payload: { targetId: i % 2 === 0 ? guard.id : wolf.id } });
  }
  await sleep(150);
  const seerFinalVote = host2.conn.view?.game?.shared?.hostVotes?.[seer.id];
  report.rapidVoteHandled = seerFinalVote === wolf.id;

  // Guard and villB also vote for wolf -> 3 votes for wolf
  await guard.ack("game:action", { type: "ww:dayVote", payload: { targetId: wolf.id } });
  await villB.ack("game:action", { type: "ww:dayVote", payload: { targetId: wolf.id } });

  console.log("Day vote edge case results:", {
    deadPlayerVoteRejected: report.deadPlayerVoteRejected,
    voteForDeadRejected: report.voteForDeadRejected,
    daySelfVoteRejected: report.daySelfVoteRejected,
    rapidVoteHandled: report.rapidVoteHandled,
  });

  // -------------------------------------------------------------------------
  // 5. Secrecy & Information Leak Audit
  // -------------------------------------------------------------------------
  console.log("Test 5: Information leakage checks");
  let rolesLeaked = false;
  let hostNightLeaked = false;
  let hostVotesLeaked = false;

  for (const client of [seer, guard, villB]) {
    for (const msg of client.conn.received) {
      const shared = msg?.game?.shared;
      if (shared) {
        if (shared.stage !== "ENDED" && shared.roles !== null) rolesLeaked = true;
        if (shared.hostNight !== null) hostNightLeaked = true;
        if (shared.hostVotes !== null) hostVotesLeaked = true;
      }
    }
  }
  report.secrecyRolesNeverLeakedBeforeEnd = !rolesLeaked;
  report.secrecyHostNightNeverLeaked = !hostNightLeaked;
  report.secrecyHostVotesNeverLeaked = !hostVotesLeaked;

  console.log("Secrecy audit results:", {
    rolesNeverLeakedBeforeEnd: report.secrecyRolesNeverLeakedBeforeEnd,
    hostNightNeverLeaked: report.secrecyHostNightNeverLeaked,
    hostVotesNeverLeaked: report.secrecyHostVotesNeverLeaked,
  });

  host2.socket.disconnect();
  for (const c of p2) c.socket.disconnect();

  // Save report
  fs.writeFileSync(
    path.join(ROOT, "docs/e2e-reports/werewolf/raw/edge-cases-result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\n=== Edge Cases Suite Succeeded ===");
  console.log(JSON.stringify(report, null, 2));
}

run().catch((e) => {
  console.error("FATAL in test-edge-cases:", e);
  process.exit(1);
});
