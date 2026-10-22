/* global setTimeout, document, innerWidth, console, history, dispatchEvent, PopStateEvent */
// Run with the web dev server at http://127.0.0.1:4202.
import { chromium } from "playwright-core";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const out = "/tmp/w2-spy-ux";
await fs.mkdir(out, { recursive: true });
const results = [];
async function screen(kind, width, height, phase) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:4202/");
  await page.evaluate(
    async ({ kind, phase }) => {
      const { spyLobby } = await import("/test/spy-ux-fixture.ts");
      const { useLobbyStore } = await import("/src/store/index.ts");
      const lobby = spyLobby(
        phase === "SETUP" ? "PREPARED" : phase === "EXPIRED" ? "FINISHED" : phase,
      );
      if (phase === "SETUP") lobby.game.stage = "CONFIGURING";
      if (phase === "EXPIRED") lobby.game.clock.done = true;
      lobby.viewer = kind === "player" ? { kind, playerId: "p0" } : { kind };
      lobby.players.forEach((p, i) => {
        p.name = ["Hoàng Ngọc Bảo Khánh", "Phạm Thị Thanh Hương", "Nguyễn Thị Ngọc Hạnh", "Minh"][
          i
        ];
      });
      lobby.me =
        kind === "player" ? { playerId: "p0", groupId: "g1", name: "Hoàng Ngọc Bảo Khánh" } : null;
      lobby.game.clock.timer.endsAt = phase === "PREPARED" ? null : Date.now() + 695000;
      if (phase === "RUNNING" || phase === "VOTING")
        lobby.game.groups[0].timer.endsAt = Date.now() + 45000;
      if (phase === "PAUSED") {
        lobby.game.clock.timer.endsAt = null;
        lobby.game.clock.timer.pausedRemainingMs = 695000;
        lobby.game.groups[0].timer.pausedRemainingMs = 45000;
      }
      if (phase === "FINISHED" || phase === "EXPIRED")
        lobby.game.groups[0].data.result = { winner: "team", reason: "caught" };
      if (kind !== "host") {
        lobby.catalog = [];
        lobby.game.config = null;
        lobby.game.groups[0].data.spies = null;
        lobby.game.groups[0].data.topic = null;
      }
      if (kind === "player") lobby.game.groups[0].currentSpeakerId = "p1";
      const { socket, saveToken } = await import("/src/socket/index.ts");
      socket.disconnect();
      saveToken("player", "ABC234", "test-player-token-1234567890");
      saveToken("host", "ABC234", "test-host-token-1234567890");
      socket.connected = true;
      socket.timeout = () => socket;
      socket.emit = (event, _payload, ack) => {
        if (["host:attach", "display:watch", "session:resume"].includes(event))
          setTimeout(() => useLobbyStore.getState().sync(lobby), 10);
        ack?.(null, {
          ok: true,
          data:
            event === "time:sync" ? { clientNow: Date.now(), serverNow: Date.now() } : undefined,
        });
        return socket;
      };
      useLobbyStore.getState().sync(lobby);
      useLobbyStore.getState().setConnection("online");
      history.pushState(
        {},
        "",
        `/${kind === "projector" ? "display" : kind === "player" ? "play" : "host"}/ABC234`,
      );
      dispatchEvent(new PopStateEvent("popstate"));
    },
    { kind, phase },
  );
  if (kind === "player") await page.locator(".player-header .cp-game-clock").waitFor();
  else
    await page
      .getByRole("heading", {
        name: kind === "host" ? "Your players" : "Who's the Spy",
        exact: true,
      })
      .first()
      .waitFor();
  if (kind === "host") await page.getByRole("tab", { name: "Game", exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${kind}-${width}-${phase}.png`, fullPage: true });
  const metrics = await page.evaluate(
    ({ kind }) => {
      const rect = (element) => {
        const r = element.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        };
      };
      const header = document.querySelector(".player-header");
      const mainButton = document.querySelector(".host-fixed-controls > button");
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        header: header ? rect(header) : null,
        mainButton: mainButton
          ? { ...rect(mainButton), scroll: mainButton.scrollWidth, client: mainButton.clientWidth }
          : null,
        clock: document.querySelector(".projector-header > .cp-game-clock")?.textContent,
        text: kind === "projector" ? document.body.innerText : null,
      };
    },
    { kind },
  );
  results.push({ kind, width, phase, ...metrics });
  assert.equal(metrics.overflow, 0, `${kind} ${width} ${phase}: page overflow`);
  if (metrics.header) assert.ok(metrics.header.height < 45, "compact single-line phone header");
  if (metrics.mainButton)
    assert.ok(metrics.mainButton.scroll <= metrics.mainButton.client, "host primary content fits");
  if (kind === "projector") {
    assert.ok(metrics.clock, "clock in header");
    assert.ok(!metrics.text.includes("Airport"), "no topic");
    assert.ok(!metrics.text.includes("Spy:"), "no spy role");
  }
  await page.close();
}
try {
  for (const phase of [
    "SETUP",
    "PREPARED",
    "RUNNING",
    "VOTING",
    "PAUSED",
    "ROUND_END",
    "FINISHED",
    "EXPIRED",
  ]) {
    await screen("player", 360, 640, phase);
    await screen("host", 412, 915, phase);
    await screen("projector", 1920, 1080, phase);
  }
  await screen("player", 390, 844, "PAUSED");
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} layouts; screenshots and metrics in ${out}`);
} finally {
  await browser.close();
}
