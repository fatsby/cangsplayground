import { schemas, type Ack, type C2SEventName, type C2SResults, type Viewer } from "@cangsplayground/core";
import type { z } from "zod";
import type { AppSocket, Broadcaster } from "../broadcast.js";
import type { Lobby } from "../lobby/Lobby.js";
import type { LobbyManager } from "../lobby/LobbyManager.js";
import { fail, failure } from "../auth/errors.js";
import type { RateLimiter } from "../auth/RateLimiter.js";
export interface Attachment {
  lobby: Lobby;
  viewer: Viewer;
}
export interface HandlerContext {
  socket: AppSocket;
  manager: LobbyManager;
  broadcaster: Broadcaster;
  limiter: RateLimiter;
  current: () => Attachment | undefined;
  attach: (lobby: Lobby, viewer: Viewer) => void;
  detach: () => void;
  removePlayer: (lobby: Lobby, playerId: string, kick: boolean) => void;
}
export type Register = <E extends C2SEventName>(
  event: E,
  handler: (
    payload: z.output<(typeof schemas)[E]>,
  ) => C2SResults[E] | (C2SResults[E] extends undefined ? void : never),
  host?: boolean,
) => void;
export function hostLobby(ctx: HandlerContext) {
  const attachment = ctx.current();
  if (!attachment || attachment.viewer.kind !== "host")
    fail("UNAUTHORIZED", "Open the Host Console first.");
  return attachment.lobby;
}
export function makeRegister(ctx: HandlerContext): Register {
  const limitedEvents = new Set<C2SEventName>([
    "display:watch",
    "lobby:join",
    "host:claim",
    "session:resume",
  ]);
  return (event, handler, host = false) => {
    // This adapter preserves each protocol event's payload/result association at registration.
    const on = ctx.socket.on.bind(ctx.socket) as (
      event: C2SEventName,
      listener: (payload: unknown, ack?: (result: Ack<any>) => void) => void,
    ) => void;
    on(event, (payload, ack) => {
      let result: Ack<any>;
      try {
        const parsed = schemas[event].safeParse(payload);
        if (!parsed.success) fail("INVALID_PAYLOAD", "Check the information and try again.");
        const ip = ctx.socket.handshake.address;
        if (limitedEvents.has(event) && ctx.limiter.limited(ip))
          fail("RATE_LIMITED", "Too many tries. Wait one minute.");
        const execute = () => handler(parsed.data as never);
        if (host) {
          const lobby = hostLobby(ctx);
          const id = (parsed.data as { commandId: string }).commandId;
          if (lobby.status === "closed" && !lobby.commands.has(id))
            fail("LOBBY_CLOSED", "This lobby has ended.");
          result = lobby.command(id, execute) as Ack<any>;
        } else {
          const value = execute();
          result = { ok: true, data: value };
        }
      } catch (error) {
        result = failure(error);
      }
      if (
        !result.ok &&
        limitedEvents.has(event) &&
        ["NOT_FOUND", "UNAUTHORIZED", "PAIR_EXPIRED"].includes(result.error.code)
      )
        ctx.limiter.fail(ctx.socket.handshake.address);
      if (typeof ack === "function") ack(result);
    });
  };
}
