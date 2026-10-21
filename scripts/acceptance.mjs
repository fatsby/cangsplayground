// PRD §17 acceptance run with 24 emulated phones that join ONLY by decoding the projector's QR.
// Usage: pnpm build && PORT=3100 pnpm start   then   pnpm acceptance http://localhost:3100 [screenshot-dir]
// Needs a Chromium: CHROMIUM_PATH=/path/to/chrome, or `pnpm exec playwright-core install chromium`.
import { chromium, devices } from "playwright-core";
import { io } from "socket.io-client";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? ".";
const N = 24;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const log = (...a) => console.log(...a);

// Laptop → create lobby → projector.
const laptop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const proj = await laptop.newPage();
await proj.goto(BASE + "/");
await proj
  .getByRole("button", { name: /create/i })
  .first()
  .click();
await proj.waitForURL(/\/display\/[A-Z0-9]{6}/);
const code = proj.url().split("/display/")[1];
const hostToken = await proj.evaluate((c) => localStorage.getItem(`clubplay:host:${c}`), code);
const qr = proj.locator(".qr-frame").first();
await qr.waitFor();

const scan = async () => {
  const png = PNG.sync.read(await qr.screenshot());
  const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!r) throw new Error("QR not decodable");
  return r.data;
};
const scanned = await scan();
log("lobby", code, "QR →", scanned);

// 24 phones: half Android, half iPhone viewports; vibrate stubbed to record calls.
const profiles = [devices["Pixel 7"], devices["iPhone 13"]];
const names = Array.from(
  { length: N },
  (_, i) =>
    ["Thảo", "Nguyễn Văn An", "Bích Ngọc", "Minh", "Lan", "Quân", "Hương", "Đức"][i % 8] +
    (i >= 8 ? ` ${Math.floor(i / 8) + 1}` : ""),
);
const t0 = Date.now();
const phones = await Promise.all(
  names.map(async (name, i) => {
    const profile = { ...profiles[i % 2] };
    delete profile.defaultBrowserType;
    const ctx = await browser.newContext(profile);
    await ctx.addInitScript(() => {
      window.__vib = [];
      Object.defineProperty(navigator, "vibrate", { value: (p) => (window.__vib.push(p), true) });
    });
    const page = await ctx.newPage();
    const url = await scan(); // every phone scans the projector itself
    await page.goto(url);
    await page.getByLabel("Your name").fill(name); // the code is pre-filled by the QR URL
    await page.getByRole("button", { name: /join/i }).last().click();
    await page.waitForURL(/\/play\//);
    return { name, page };
  }),
);
const joinMs = Date.now() - t0;
const listed = await proj.evaluate(() => document.body.innerText);
log(
  `AC1 ${N} phones joined via QR in ${(joinMs / 1000).toFixed(1)} s (no code typed); projector lists all: ${names.every((n) => listed.includes(n))}`,
);

// Host over socket with the laptop's token.
const host = io(BASE, { transports: ["websocket"] });
let hv;
host.on("state:sync", (v) => (hv = v));
host.on("state:patch", (p) => (hv = { ...hv, ...p }));
await new Promise((r) => host.once("connect", r));
const ack = (e, p) =>
  new Promise((res, rej) =>
    host.emit(e, p, (a) => (a.ok ? res(a.data) : rej(new Error(JSON.stringify(a.error))))),
  );
const settle = async (ok) => {
  for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 10));
};
let n = 0;
const cid = () => `ac-${++n}`;
await ack("host:attach", { code, hostToken });

// AC2: 4 groups, every phone shows its team < 1 s, projector matches.
const tA = Date.now();
await Promise.all(
  phones.map(({ page }) =>
    page.evaluate(() => {
      window.__teamAt = null;
      const check = () => {
        if (!window.__teamAt && /Team (Red|Blue|Yellow|Green)/.test(document.body.innerText))
          window.__teamAt = Date.now();
      };
      new MutationObserver(check).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }),
  ),
);
let gv = hv.groupsVersion;
await ack("groups:assign", { mode: "count", value: 4, commandId: cid() });
await settle(() => hv.groupsVersion > gv);
const expected = new Map();
for (const g of hv.groups)
  for (const id of g.playerIds) expected.set(hv.players.find((p) => p.id === id).name, g.name);
const shown = await Promise.all(
  phones.map(async ({ name, page }) => {
    await page.waitForFunction(
      (t) => document.body.innerText.includes(t),
      expected.get(name).replace("Team ", ""),
      { timeout: 5000 },
    );
    return (await page.evaluate(() => window.__teamAt)) - tA;
  }),
);
const projText = await proj.evaluate(() => document.body.innerText);
log(
  `AC2 all ${N} phones show their team after max ${Math.max(...shown)} ms; sizes ${hv.groups.map((g) => g.playerIds.length)}; projector shows all 4 teams: ${hv.groups.every((g) => projText.includes(g.name.replace("Team ", "")))}`,
);
await phones[0].page.screenshot({ path: `${OUT}/ac-phone-team.png` });
await proj.waitForTimeout(2500); // let the GRP-07 shuffle animation finish
await proj.screenshot({ path: `${OUT}/ac-projector-groups.png` });

// AC3: max 7 per group with 24 → 6,6,6,6.
gv = hv.groupsVersion;
await ack("groups:assign", { mode: "maxSize", value: 7, commandId: cid() });
await settle(() => hv.groupsVersion > gv);
log(`AC3 maxSize 7 → ${hv.groups.map((g) => g.playerIds.length)}`);

// Free Talk round: YOUR TURN + vibrate on the current speakers' phones.
await ack("game:select", { gameId: "free-talk", commandId: cid() });
await ack("game:configure", {
  config: { prompt: "What did you do last weekend?", turnSeconds: 60 },
  commandId: cid(),
});
await ack("game:control", { cmd: "prepare", commandId: cid() });
await ack("game:control", { cmd: "start", commandId: cid() });
await settle(() => hv.game?.groups?.every((g) => g.phase === "RUNNING"));
await new Promise((r) => setTimeout(r, 1000));
const speakers = new Set(
  hv.game.groups.map((g) => hv.players.find((p) => p.id === g.turnOrder[g.turnIndex]).name),
);
let yourTurnOk = 0;
for (const { name, page } of phones) {
  const text = await page.evaluate(() => document.body.innerText);
  const vib = await page.evaluate(() => window.__vib.length);
  if (speakers.has(name) && /YOUR\s*TURN/i.test(text) && vib > 0) yourTurnOk++;
}
log(`TMR-03 YOUR TURN + vibrate on ${yourTurnOk}/${speakers.size} current speakers`);
const sp = phones.find((p) => speakers.has(p.name));
await sp.page.screenshot({ path: `${OUT}/ac-your-turn.png` });

// AC4: reload a player mid-game → same group, turn, timer ±1 s.
const victim = phones.find((p) => !speakers.has(p.name));
const before = await victim.page.evaluate(() => document.body.innerText);
await victim.page.reload();
await victim.page.waitForFunction(() => /\d:\d\d/.test(document.body.innerText));
const after = await victim.page.evaluate(() => document.body.innerText);
const team = (t) => /Team \w+/.exec(t)?.[0];
const clock = (t) => /(\d):(\d\d)/.exec(t);
const secs = (m) => +m[1] * 60 + +m[2];
log(
  `AC4 reload keeps team ${team(before)} → ${team(after)}; timer ${clock(before)?.[0]} → ${clock(after)?.[0]} (Δ ${Math.abs(secs(clock(before)) - secs(clock(after)))} s)`,
);

// AC5: nothing host/private in what the phones and projector store/receive.
const leak = [];
for (const { page } of [{ page: proj }, ...phones]) {
  const html = await page.content();
  if (html.includes(hostToken) && page !== proj) leak.push("hostToken in phone DOM");
}
log(`AC5 phones' DOM free of hostToken: ${leak.length === 0}`);

// AC6: change game / re-assign several times in the same lobby.
for (let i = 0; i < 3; i++) {
  await ack("groups:assign", { mode: "count", value: 3 + i, confirm: true, commandId: cid() });
  await ack("game:select", { gameId: i % 2 ? "free-talk" : "secret-word", commandId: cid() });
  await ack("game:control", { cmd: "prepare", commandId: cid() });
  await ack("game:control", { cmd: "exit", commandId: cid() });
}
log(`AC6 3× re-assign + change game in lobby ${hv.code} (same code: ${hv.code === code})`);

host.disconnect();
await browser.close();
