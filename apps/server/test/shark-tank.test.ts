import { afterEach, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  applyPatch,
  type Ack,
  type C2SEventName,
  type C2SPayload,
  type C2SResults,
  type ClientToServerEvents,
  type LobbyView,
  type ServerToClientEvents,
} from "@cangsplayground/core";
import sharkTank, {
  PART_FRAMES,
  blankCount,
  type SharkTankShared,
  type SharkTankView,
} from "@cangsplayground/game-shark-tank";
import { computeResults } from "../../../packages/games/shark-tank/src/rules.js";
import { buildView } from "../src/broadcast.js";
import { createServer } from "../src/index.js";
import { Lobby } from "../src/lobby/Lobby.js";

const state = (lobby: Lobby) => lobby.game!.shared as SharkTankShared;
const hostView = (lobby: Lobby) => buildView(lobby, { kind: "host" }).game!.shared as SharkTankView;
function next(lobby: Lobby) {
  const shared = state(lobby);
  lobby.hostAction({
    type: "st:next",
    payload: { from: shared.stage, presenterIndex: shared.presenterIndex },
  });
}
function lobbySetup(n = 10, groups = 3, prepare = true) {
  const lobby = new Lobby({
    code: "ABC234",
    hostToken: "host-secret-token",
    seed: 3,
    now: () => 1000,
  });
  const players = Array.from({ length: n }, (_, i) => lobby.join(`Player ${i}`));
  lobby.selectGame(sharkTank.id);
  lobby.assign("count", groups);
  lobby.configure(sharkTank.defaultConfig);
  if (prepare) lobby.control("prepare");
  return { lobby, players };
}
function play(lobby: Lobby) {
  for (const [index, company] of state(lobby).companies.entries())
    lobby.action(company.members[0]!, { type: "st:price", payload: { price: 20 + index * 20 } });
  next(lobby);
  for (let pitches = 0; state(lobby).stage !== "RESULTS" && pitches < 12; pitches++) {
    expect(state(lobby).stage).toBe("PITCH");
    next(lobby);
    const sellerId = state(lobby).order[state(lobby).presenterIndex]!;
    const buyers = state(lobby).companies.filter((c) => c.groupId !== sellerId && c.members.length);
    for (const buyer of buyers)
      lobby.hostAction({ type: "st:asked", payload: { playerId: buyer.members[0] } });
    next(lobby);
    for (const buyer of buyers)
      for (const playerId of buyer.members)
        lobby.action(playerId, { type: "st:vote", payload: { quantity: 1 } });
    expect(state(lobby).locked).toEqual(expect.arrayContaining(buyers.map((c) => c.groupId)));
    next(lobby);
    expect(state(lobby).stage).toBe("DECISION");
    next(lobby);
  }
  expect(state(lobby).stage).toBe("RESULTS");
}

it("plays a full 3-group game through Lobby", () => {
  const { lobby } = lobbySetup();
  play(lobby);
  const results = hostView(lobby).results!;
  expect(results.scores).toHaveLength(3);
  expect(results).toEqual(
    computeResults(state(lobby), sharkTank.configSchema.parse(lobby.game!.config)),
  );
  expect(state(lobby).purchases).toHaveLength(6);
  expect(state(lobby).presented).toEqual(state(lobby).order);
  for (const company of state(lobby).companies) {
    const spending = results.scores.find((s) => s.groupId === company.groupId)!.spent;
    expect(company.wallet).toBe(company.startWallet - spending);
  }
  expect(lobby.game!.groups.every((g) => g.phase === "PREPARED")).toBe(true);
});

it("plays a 2-group game without a Best Shark award", () => {
  const { lobby } = lobbySetup(6, 2);
  play(lobby);
  expect(hostView(lobby).results!.scores).toHaveLength(2);
  expect(hostView(lobby).results!.bestShark).toEqual([]);
  expect(state(lobby).purchases).toHaveLength(2);
});

it.each([
  [4, 1],
  [12, 2],
  [26, 13],
] as const)("blocks Prepare for %i players in %i groups", (players, groups) => {
  const { lobby } = lobbySetup(players, groups, false);
  expect(() => lobby.control("prepare")).toThrowError(
    expect.objectContaining({ code: "GROUPS_TOO_SMALL" }),
  );
  expect(lobby.game!.stage).toBe("CONFIGURING");
  expect(lobby.game!.shared).toBeNull();
});

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: Client[] = [];
let server: Awaited<ReturnType<typeof createServer>> | undefined;
afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await server?.close();
  server = undefined;
});
function ack<E extends C2SEventName>(client: Client, event: E, payload: C2SPayload<E>) {
  return new Promise<C2SResults[E]>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`No acknowledgement for ${event}`)), 3000);
    const emit = client.emit.bind(client) as (
      event: E,
      payload: C2SPayload<E>,
      cb: (result: Ack<C2SResults[E]>) => void,
    ) => void;
    emit(event, payload, (result) => {
      clearTimeout(timeout);
      if (result.ok) resolve(result.data);
      else reject(new Error(`${result.error.code}: ${result.error.message}`));
    });
  });
}
async function connect(url: string) {
  const socket: Client = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  const observed: { view?: LobbyView; raw: string; syncs: LobbyView[]; patches: number } = {
    raw: "",
    syncs: [],
    patches: 0,
  };
  socket.on("state:sync", (view) => {
    observed.raw += JSON.stringify(view);
    observed.view = view;
    observed.syncs.push(view);
  });
  socket.on("state:patch", (patch) => {
    observed.raw += JSON.stringify(patch);
    observed.patches++;
    if (observed.view) observed.view = applyPatch(observed.view, patch);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, observed };
}
const until = (check: () => boolean) =>
  expect.poll(check, { timeout: 3000, interval: 10 }).toBe(true);
const sharedView = (client: Awaited<ReturnType<typeof connect>>) =>
  client.observed.view?.game?.shared as SharkTankView | undefined;
async function socketSetup(n = 6, groups = 3) {
  server = await createServer({ seed: 3 });
  const url = await server.listen(0, "127.0.0.1");
  const host = await connect(url);
  const { code, hostToken } = await ack(host.socket, "lobby:create", {});
  await ack(host.socket, "host:attach", { code, hostToken });
  const projector = await connect(url);
  await ack(projector.socket, "display:watch", { code });
  const players = await Promise.all(
    Array.from({ length: n }, async (_, index) => {
      const client = await connect(url);
      return {
        ...client,
        ...(await ack(client.socket, "lobby:join", { code, name: `Player ${index}` })),
      };
    }),
  );
  let sequence = 0;
  const commandId = () => `shark-${++sequence}`;
  await ack(host.socket, "game:select", { gameId: sharkTank.id, commandId: commandId() });
  await ack(host.socket, "groups:assign", { mode: "count", value: groups, commandId: commandId() });
  await ack(host.socket, "game:control", { cmd: "prepare", commandId: commandId() });
  const lobby = server.manager.get(code);
  const hostAction = (type: string, payload?: unknown) =>
    ack(host.socket, "game:hostAction", { type, payload, commandId: commandId() });
  const hostNext = () =>
    hostAction("st:next", {
      from: state(lobby).stage,
      presenterIndex: state(lobby).presenterIndex,
    });
  const player = (id: string) => players.find((p) => p.playerId === id)!;
  return { host, projector, players, player, code, lobby, url, hostAction, hostNext, commandId };
}

it("keeps PREP tabs personal across broadcasts and resume while sharing idea lock votes", async () => {
  const s = await socketSetup(8, 2);
  const c = state(s.lobby).companies[0]!;
  const first = s.player(c.members[0]!);
  const second = s.player(c.members[1]!);
  const own = (client: typeof first) =>
    sharedView(client)?.companies.find((company) => company.groupId === c.groupId);
  await ack(first.socket, "game:action", { type: "st:step", payload: { step: 2 } });
  await ack(second.socket, "game:action", { type: "st:step", payload: { step: 4 } });
  await until(() => own(first)?.prepStep === 2 && own(second)?.prepStep === 4);
  expect(own(first)?.rerollAllowed).toBe(true);
  first.socket.disconnect();
  const resumed = await connect(s.url);
  await ack(resumed.socket, "session:resume", { token: first.playerToken });
  await until(() => sharedView(resumed)?.companies[0]?.prepStep === 2);
  await ack(resumed.socket, "game:action", {
    type: "st:lockIdea",
    payload: { ideaId: c.ideaId },
  });
  await until(() => own(second)?.ideaLockVotes?.length === 1);
  expect(own(second)?.ideaLocked).toBe(false);
  expect(own(second)?.rerollAllowed).toBe(true);
  await ack(second.socket, "game:action", {
    type: "st:lockIdea",
    payload: { ideaId: c.ideaId },
  });
  await until(() => sharedView(resumed)?.companies[0]?.ideaLocked === true);
  expect(sharedView(resumed)?.companies[0]?.rerollAllowed).toBe(false);
  expect(sharedView(resumed)?.companies[0]?.prepStep).toBe(2);
  await until(() => own(second)?.ideaLocked === true);
  expect(own(second)?.prepStep).toBe(4);
});

it("a kicked non-voter mid-huddle transfers their parts and locks the remaining votes", async () => {
  const s = await socketSetup(6, 2);
  for (const c of state(s.lobby).companies) {
    const id = c.members.at(-1)!,
      part = c.parts[id]![0]!;
    await ack(s.player(id).socket, "game:action", {
      type: "st:script",
      payload: {
        part,
        blanks: Array.from({ length: blankCount(PART_FRAMES[part]) }, () => "saved words"),
      },
    });
  }
  await s.hostNext();
  await s.hostNext();
  const raw = state(s.lobby),
    sellerId = raw.order[raw.presenterIndex]!;
  const buyer = raw.companies.find((c) => c.groupId !== sellerId)!;
  const leaver = buyer.members.at(-1)!,
    recipient = buyer.members[0]!;
  await s.hostAction("st:asked", { playerId: recipient });
  await s.hostNext();
  for (const id of buyer.members.filter((id) => id !== leaver))
    await ack(s.player(id).socket, "game:action", { type: "st:vote", payload: { quantity: 1 } });
  expect(state(s.lobby).locked).not.toContain(buyer.groupId);
  const kicked = new Promise<void>((resolve) =>
    s.player(leaver).socket.once("session:kicked", resolve),
  );
  await ack(s.host.socket, "lobby:kick", { playerId: leaver, commandId: s.commandId() });
  await kicked;
  const after = state(s.lobby).companies.find((c) => c.groupId === buyer.groupId)!;
  expect(after.members).not.toContain(leaver);
  expect(after.formerMembers).toContain(leaver);
  expect(after.parts[recipient]).toEqual(["problem", "price", "ask"]);
  expect(after.scripts.price).toEqual(["saved words"]);
  expect(after.wallet).toBe(265);
  expect(after.startWallet).toBe(300);
  expect(state(s.lobby).locked).toContain(buyer.groupId);
  expect(state(s.lobby).purchases).toEqual([
    { buyer: buyer.groupId, seller: sellerId, quantity: 1, price: 35 },
  ]);
  expect(s.lobby.players.has(leaver)).toBe(false);
  expect(s.lobby.warnings).toEqual([]);
  for (let i = 0; state(s.lobby).stage !== "RESULTS" && i < 12; i++) await s.hostNext();
  expect(hostView(s.lobby).results!.scores).toHaveLength(2);
}, 15000);

it.each(["HUDDLE", "DECISION"] as const)(
  "keeps projector syncs, patches and reconnects private during %s",
  async (stage) => {
    const s = await socketSetup();
    for (const c of state(s.lobby).companies) {
      const id = c.members[0]!,
        part = c.parts[id]![0]!;
      await ack(s.player(id).socket, "game:action", {
        type: "st:script",
        payload: {
          part,
          blanks: Array.from(
            { length: blankCount(PART_FRAMES[part]) },
            () => "private saved words",
          ),
        },
      });
    }
    await s.hostNext();
    await s.hostNext();
    const raw = state(s.lobby),
      sellerId = raw.order[raw.presenterIndex]!;
    const buyers = raw.companies.filter((c) => c.groupId !== sellerId);
    for (const buyer of buyers) await s.hostAction("st:asked", { playerId: buyer.members[0] });
    await s.hostNext();
    for (const id of buyers[0]!.members)
      await ack(s.player(id).socket, "game:action", { type: "st:vote", payload: { quantity: 1 } });
    await ack(s.player(buyers[1]!.members[0]!).socket, "game:action", {
      type: "st:vote",
      payload: { quantity: 2 },
    });
    expect(state(s.lobby).purchases.length).toBeGreaterThan(0);
    if (stage === "DECISION") await s.hostNext();
    await until(
      () =>
        sharedView(s.projector)?.stage === stage &&
        !!sharedView(s.projector)?.companies.find((c) => c.groupId === buyers[0]!.groupId)?.voted,
    );
    s.projector.socket.disconnect();
    const reconnected = await connect(s.url);
    await ack(reconnected.socket, "display:watch", { code: s.code });
    await until(() => sharedView(reconnected)?.stage === stage);
    expect(s.projector.observed.patches).toBeGreaterThan(0);
    expect(reconnected.observed.syncs).toHaveLength(1);
    for (const client of [s.projector, reconnected]) {
      const json = client.observed.raw;
      expect(json).not.toMatch(/"(?:wallet|revenue|minSpendLeft)":\s*-?\d/);
      expect(json).not.toContain('"votes":{');
      expect(json).not.toContain('"quantity"');
      expect(json).not.toContain('"scripts":{');
      expect(json).not.toContain("private saved words");
      for (const c of sharedView(client)!.companies)
        expect(c).toMatchObject({
          wallet: null,
          minSpendLeft: null,
          votes: null,
          purchases: null,
          revenue: null,
          scripts: null,
          help: null,
          eligible: null,
        });
    }
    const seller = state(s.lobby).companies.find((c) => c.groupId === sellerId)!;
    const sellerPhone = s.player(seller.members[0]!);
    await until(() => sharedView(sellerPhone)?.stage === stage);
    expect(sellerPhone.observed.raw).not.toContain('"quantity"');
    expect(
      sharedView(sellerPhone)!.companies.find((c) => c.groupId === sellerId)!.revenue,
    ).toBeNull();
  },
  15000,
);

it("session:resume restores the player's group, speaking parts and own scripts", async () => {
  const s = await socketSetup();
  const c = state(s.lobby).companies[0]!,
    id = c.members[0]!,
    part = c.parts[id]![0]!;
  const blanks = Array.from({ length: blankCount(PART_FRAMES[part]) }, () => "my saved script");
  const player = s.player(id);
  await ack(player.socket, "game:action", { type: "st:script", payload: { part, blanks } });
  const before = structuredClone(state(s.lobby).companies[0]!);
  player.socket.disconnect();
  await until(() => s.lobby.players.get(id)!.sockets.size === 0);
  const resumed = await connect(s.url);
  expect(await ack(resumed.socket, "session:resume", { token: player.playerToken })).toEqual({
    code: s.code,
    playerId: id,
  });
  await until(() => sharedView(resumed)?.stage === "PREP");
  expect(resumed.observed.view!.me).toMatchObject({ playerId: id, groupId: c.groupId });
  const own = sharedView(resumed)!.companies.find((company) => company.groupId === c.groupId)!;
  expect(own.scripts![part]).toEqual(blanks);
  expect(own.parts).toEqual(before.parts);
  expect(own.wallet).toBe(before.wallet);
  for (const other of sharedView(resumed)!.companies.filter(
    (company) => company.groupId !== c.groupId,
  ))
    expect(other).toMatchObject({
      scripts: null,
      wallet: null,
      votes: null,
      idea: null,
      parts: null,
    });
}, 15000);

it("a disconnected player who lost their token rejoins the running game by typing the same name", async () => {
  const s = await socketSetup();
  const c = state(s.lobby).companies[0]!,
    id = c.members[0]!;
  const player = s.player(id);
  const name = s.lobby.players.get(id)!.name;
  const otherBrowser = await connect(s.url);
  await expect(
    ack(otherBrowser.socket, "lobby:join", { code: s.code, name: ` ${name.toUpperCase()} ` }),
  ).rejects.toThrow("NAME_TAKEN");
  await ack(s.host.socket, "lobby:lock", { locked: true, commandId: s.commandId() });
  player.socket.disconnect();
  await until(() => s.lobby.players.get(id)!.sockets.size === 0);
  expect(
    await ack(otherBrowser.socket, "lobby:join", { code: s.code, name: name.toUpperCase() }),
  ).toEqual({ playerToken: player.playerToken, playerId: id });
  await until(() => sharedView(otherBrowser)?.stage === "PREP");
  expect(otherBrowser.observed.view!.me).toMatchObject({ playerId: id, groupId: c.groupId });
  expect(s.lobby.players.size).toBe(6);
}, 15000);

it("a socket disconnect locks the last pending buyer without moving parts, and reconnect never charges twice", async () => {
  const s = await socketSetup(4, 2);
  await s.hostNext();
  await s.hostNext();
  const raw = state(s.lobby),
    sellerId = raw.order[raw.presenterIndex]!;
  const buyer = raw.companies.find((c) => c.groupId !== sellerId)!;
  await s.hostAction("st:asked", { playerId: buyer.members[0] });
  await s.hostNext();
  await ack(s.player(buyer.members[0]!).socket, "game:action", {
    type: "st:vote",
    payload: { quantity: 1 },
  });
  expect(state(s.lobby).locked).not.toContain(buyer.groupId);
  const absent = s.player(buyer.members[1]!),
    parts = structuredClone(buyer.parts);
  absent.socket.disconnect();
  await until(() => state(s.lobby).locked.includes(buyer.groupId));
  expect(state(s.lobby).companies.find((c) => c.groupId === buyer.groupId)).toMatchObject({
    parts,
    members: buyer.members,
    formerMembers: [],
    wallet: 165,
  });
  expect(state(s.lobby).left).toEqual([]);
  const resumed = await connect(s.url);
  await ack(resumed.socket, "session:resume", { token: absent.playerToken });
  expect(state(s.lobby).purchases).toHaveLength(1);
  expect(state(s.lobby).companies.find((c) => c.groupId === buyer.groupId)!.wallet).toBe(165);
}, 15000);

it("host actions require host authentication and cache duplicate command ids without advancing twice", async () => {
  const s = await socketSetup(4, 2);
  const payload = {
    type: "st:next",
    payload: { from: "PREP", presenterIndex: 0 },
    commandId: "first-next",
  };
  for (const client of [s.projector.socket, s.players[0]!.socket])
    await expect(ack(client, "game:hostAction", payload)).rejects.toThrow(/UNAUTHORIZED/);
  await ack(s.host.socket, "game:hostAction", payload);
  await ack(s.host.socket, "game:hostAction", payload);
  expect(state(s.lobby).stage).toBe("PITCH");
  await expect(
    ack(s.host.socket, "game:hostAction", { ...payload, commandId: "stale-next" }),
  ).rejects.toThrow(/INVALID_STATE/);
  expect(state(s.lobby).stage).toBe("PITCH");
  await expect(
    ack(s.host.socket, "game:control", { cmd: "start", commandId: s.commandId() }),
  ).rejects.toThrow(/own controls/);
}, 15000);
