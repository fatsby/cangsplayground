import { performance } from "node:perf_hooks";
import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  C2SEventName,
  C2SPayload,
  C2SResults,
  ClientToServerEvents,
  LobbyPatch,
  ServerToClientEvents,
} from "@clubplay/core";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const args = process.argv.slice(2);
const argument = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : (args[index + 1] ?? fallback);
};
const url = argument("--url", "http://localhost:3000");
const count = Number(argument("--clients", "30"));
const sockets: Client[] = [];
let host: Client | undefined;
let code: string | undefined;
let sequence = 0;
const commandId = () => `sim-${++sequence}`;
async function connect() {
  const socket: Client = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Connection timed out.")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return socket;
}
function send<E extends C2SEventName>(
  socket: Client,
  event: E,
  payload: C2SPayload<E>,
): Promise<C2SResults[E]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${event} timed out.`)), 5000);
    const emit = socket.emit.bind(socket) as (
      event: E,
      payload: C2SPayload<E>,
      ack: (result: Ack<C2SResults[E]>) => void,
    ) => void;
    emit(event, payload, (result) => {
      clearTimeout(timeout);
      if (result.ok) resolve(result.data);
      else reject(new Error(`${result.error.code}: ${result.error.message}`));
    });
  });
}
try {
  if (!Number.isInteger(count) || count < 2 || count > 60) throw new Error("Use 2 to 60 clients.");
  host = await connect();
  const lobby = await send(host, "lobby:create", {});
  code = lobby.code;
  await send(host, "host:attach", lobby);
  const players = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const socket = await connect();
      await send(socket, "lobby:join", { code: code!, name: `Sim${index + 1}` });
      return socket;
    }),
  );
  const samples: number[] = [];
  async function measured(run: () => Promise<unknown>, matches: (patch: LobbyPatch) => boolean) {
    const started = performance.now();
    const received = players.map(
      (socket) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off("state:patch", listener);
            reject(new Error("State patch timed out."));
          }, 5000);
          const listener = (patch: LobbyPatch) => {
            if (!matches(patch)) return;
            socket.off("state:patch", listener);
            clearTimeout(timeout);
            samples.push(performance.now() - started);
            resolve();
          };
          socket.on("state:patch", listener);
        }),
    );
    await Promise.all([run(), ...received]);
  }
  await measured(
    () =>
      send(host!, "groups:assign", {
        mode: "count",
        value: Math.min(4, Math.floor(count / 2)),
        commandId: commandId(),
      }),
    (patch) => patch.groupsVersion === 1,
  );
  await measured(
    () => send(host!, "game:select", { gameId: "free-talk", commandId: commandId() }),
    (patch) => patch.game?.stage === "CONFIGURING",
  );
  await measured(
    () => send(host!, "game:control", { cmd: "prepare", commandId: commandId() }),
    (patch) => patch.game?.groups[0]?.phase === "PREPARED",
  );
  await measured(
    () => send(host!, "game:control", { cmd: "start", commandId: commandId() }),
    (patch) => patch.game?.groups[0]?.phase === "RUNNING",
  );
  for (let i = 0; i < 5; i++)
    await measured(
      () =>
        send(host!, "game:control", {
          cmd: i % 2 === 0 ? "pause" : "resume",
          commandId: commandId(),
        }),
      (patch) => patch.game?.groups[0]?.phase === (i % 2 === 0 ? "PAUSED" : "RUNNING"),
    );
  samples.sort((a, b) => a - b);
  const percentile = (p: number) =>
    samples[Math.min(samples.length - 1, Math.ceil(samples.length * p) - 1)]!.toFixed(2);
  process.stdout.write(
    `Lobby ${code}: ${count} clients, ${samples.length} state:patch samples\np50 latency: ${percentile(0.5)} ms\np95 latency: ${percentile(0.95)} ms\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (host?.connected && code)
    try {
      await send(host, "lobby:close", { commandId: commandId() });
    } catch {
      process.exitCode = 1;
    }
  for (const socket of sockets) socket.disconnect();
}
