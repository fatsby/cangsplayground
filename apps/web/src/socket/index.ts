import { io, type Socket } from "socket.io-client";
import {
  schemas,
  type Ack,
  type C2SEventName,
  type C2SPayload,
  type C2SResults,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from "@cangsplayground/core";
import { useLobbyStore } from "../store";
import { bestClockSample, type ClockSample } from "./clock";
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  reconnection: true,
});
export const tokenKey = (role: "host" | "player", code: string) => `cangsplayground:${role}:${code}`;
export function readToken(role: "host" | "player", code: string) {
  return localStorage.getItem(tokenKey(role, code));
}
export function saveToken(role: "host" | "player", code: string, token: string) {
  localStorage.setItem(tokenKey(role, code), token);
}
export function clearTokens(code: string) {
  localStorage.removeItem(tokenKey("host", code));
  localStorage.removeItem(tokenKey("player", code));
}
export function request<E extends C2SEventName>(
  event: E,
  payload: C2SPayload<E>,
): Promise<Ack<C2SResults[E]>> {
  const parsed = schemas[event].safeParse(payload);
  if (!parsed.success)
    return Promise.resolve({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: parsed.error.issues[0]?.message ?? "Please check your input.",
      },
    });
  return new Promise((resolve) => {
    // Socket.IO's conditional event tuple loses the event/payload correlation for a generic E.
    const emit = socket.timeout(10000).emit as unknown as (
      event: E,
      payload: C2SPayload<E>,
      ack: (error: Error | null, result: Ack<C2SResults[E]>) => void,
    ) => void;
    emit.call(socket.timeout(10000), event, payload, (error, result) =>
      resolve(
        error
          ? { ok: false, error: { code: "INVALID_STATE", message: "No reply. Please try again." } }
          : result,
      ),
    );
  });
}
type HostEvent = {
  [E in C2SEventName]: C2SPayload<E> extends { commandId: string } ? E : never;
}[C2SEventName];
export function hostCommand<E extends HostEvent>(
  event: E,
  payload: Omit<C2SPayload<E>, "commandId">,
) {
  return request(event, { ...payload, commandId: crypto.randomUUID() } as C2SPayload<E>);
}
let sample: ClockSample | null = null;
let probing = false;
export async function syncClock() {
  if (probing || !socket.connected) return;
  probing = true;
  sample = null;
  try {
    for (let i = 0; i < 5; i++) {
      const sent = Date.now(),
        result = await request("time:sync", { clientNow: sent });
      if (result.ok) {
        sample = bestClockSample(sample, sent, result.data.serverNow, Date.now());
        useLobbyStore.getState().setOffset(sample.offset);
      }
    }
  } finally {
    probing = false;
  }
}
export type Role =
  | { kind: "projector"; code: string }
  | { kind: "host"; code: string; token: string }
  | { kind: "player"; code: string; token: string };
let role: Role | null = null;
let attachError: ((ack: Extract<Ack<unknown>, { ok: false }>) => void) | null = null;
async function attach() {
  const current = role;
  if (!current) return;
  const result =
    current.kind === "projector"
      ? await request("display:watch", { code: current.code })
      : current.kind === "host"
        ? await request("host:attach", { code: current.code, hostToken: current.token })
        : await request("session:resume", { token: current.token });
  if (role !== current) return;
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "UNAUTHORIZED") {
      localStorage.removeItem(tokenKey(current.kind === "host" ? "host" : "player", current.code));
    }
    attachError?.(result);
  }
}
export function connectRole(
  next: Role,
  onError: (ack: Extract<Ack<unknown>, { ok: false }>) => void,
) {
  role = next;
  attachError = onError;
  useLobbyStore.getState().reset();
  if (socket.connected) void attach();
  else socket.connect();
  return () => {
    if (role === next) {
      role = null;
      attachError = null;
    }
  };
}
export function connect() {
  if (!socket.connected) socket.connect();
}
socket.on("connect", () => {
  useLobbyStore.getState().setConnection("online");
  void attach();
  void syncClock();
});
socket.on("disconnect", () => useLobbyStore.getState().setConnection("reconnecting"));
socket.on("connect_error", () => useLobbyStore.getState().setConnection("reconnecting"));
socket.on("state:sync", (view) => {
  if (role && view.code === role.code && view.viewer.kind === role.kind)
    useLobbyStore.getState().sync(view);
});
socket.on("state:patch", (patch) => useLobbyStore.getState().patch(patch));
socket.on("time:sync", () => {
  void syncClock();
});
function finish(status: "closed" | "kicked") {
  if (role) {
    if (status === "closed") clearTokens(role.code);
    else if (role.kind === "player") localStorage.removeItem(tokenKey("player", role.code));
  }
  role = null;
  useLobbyStore.getState().finish(status);
}
socket.on("lobby:closed", () => finish("closed"));
socket.on("session:kicked", () => finish("kicked"));
setInterval(() => {
  void syncClock();
}, 30000);
