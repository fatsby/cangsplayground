import { z } from "zod";
import { avatarSchema } from "./avatar.js";
import { LOBBY_CODE_LENGTH } from "./lobbyCode.js";
import { PLAYER_NAME_MAX, type LobbyView } from "./types.js";

/**
 * Socket.IO protocol (PRD §10, TECH-STACK §5).
 * - Event names are `domain:action`.
 * - Every C→S event takes (payload, ack); ack receives Ack<T>.
 * - Server validates every payload with the schemas below before touching state.
 * - Host commands carry `commandId` (idempotent: a repeated id returns the first result).
 */

export type ErrorCode =
  | "INVALID_PAYLOAD"
  | "NOT_FOUND" // lobby code / token unknown
  | "UNAUTHORIZED" // socket is not host / not this player
  | "LOBBY_CLOSED"
  | "LOBBY_LOCKED"
  | "LOBBY_FULL"
  | "NAME_INVALID"
  | "NAME_TAKEN"
  | "RATE_LIMITED"
  | "PAIR_EXPIRED"
  | "INVALID_STATE" // e.g. "start" while CONFIGURING
  | "CONFIRM_REQUIRED" // re-assign while a game is running, needs confirm: true
  | "GROUPS_TOO_SMALL";

export type Ack<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; suggestion?: string } };

const code = z.string().trim().toUpperCase().length(LOBBY_CODE_LENGTH);
const token = z.string().min(16).max(128);
const commandId = z.string().min(1).max(64);

export const schemas = {
  "lobby:create": z.object({}).strict(),
  /** Projector (or anyone) subscribes to the public view of a lobby. */
  "display:watch": z.object({ code }),
  /** Laptop (holds hostToken) asks for a one-time, short-lived pairing token for the host-phone QR (LOB-03). */
  "host:pair": z.object({ code, hostToken: token }),
  /** Host phone exchanges the pairing token from the QR for the real hostToken. */
  "host:claim": z.object({ code, pairToken: token }),
  /** Host Console authenticates its socket. */
  "host:attach": z.object({ code, hostToken: token }),
  "lobby:join": z.object({ code, name: z.string().trim().min(1).max(PLAYER_NAME_MAX) }),
  /** Player reconnect / reload (JOIN-03). */
  "session:resume": z.object({ token }),
  "session:leave": z.object({}).strict(),
  "player:avatar": z.object({ avatar: avatarSchema }).strict(),
  "lobby:lock": z.object({ locked: z.boolean(), commandId }),
  "lobby:kick": z.object({ playerId: z.string().min(1), commandId }),
  "lobby:close": z.object({ commandId }),
  "groups:assign": z.object({
    mode: z.enum(["count", "maxSize"]),
    value: z.number().int().min(1).max(60),
    /** Required when a game is in progress (GRP-03, edge case "re-assign while running"). */
    confirm: z.boolean().optional(),
    commandId,
  }),
  /** GRP-08 / JOIN-05. toGroupId null = remove from group. */
  "groups:move": z.object({
    playerId: z.string().min(1),
    toGroupId: z.string().min(1).nullable(),
    commandId,
  }),
  "game:select": z.object({ gameId: z.string().min(1), commandId }),
  "game:configure": z.object({ config: z.record(z.string(), z.unknown()), commandId }),
  "game:control": z.object({
    cmd: z.enum([
      "prepare",
      "start",
      "pause",
      "resume",
      "skip",
      "extend",
      "endRound",
      "reveal",
      "nextRound",
      "exit",
    ]),
    /** Omit to apply to every group (GAME-05). */
    groupId: z.string().min(1).optional(),
    commandId,
  }),
  /** Player action; core handles type "turn:done" (TMR-05), the rest go to the module. */
  "game:action": z.object({ type: z.string().min(1).max(64), payload: z.unknown().optional() }),
  "game:hostAction": z.object({
    type: z.string().min(1).max(64),
    payload: z.unknown().optional(),
    commandId,
  }),
  /** Clock-offset probe (TMR-01). */
  "time:sync": z.object({ clientNow: z.number() }),
} as const;

export type C2SEventName = keyof typeof schemas;
export type C2SPayload<E extends C2SEventName> = z.input<(typeof schemas)[E]>;

/** Ack data per C→S event. */
export interface C2SResults {
  "lobby:create": { code: string; hostToken: string };
  "display:watch": undefined;
  "host:pair": { pairToken: string; expiresAt: number };
  "host:claim": { hostToken: string };
  "host:attach": undefined;
  "lobby:join": { playerToken: string; playerId: string };
  "session:resume": { code: string; playerId: string };
  "session:leave": undefined;
  "player:avatar": undefined;
  "lobby:lock": undefined;
  "lobby:kick": undefined;
  "lobby:close": undefined;
  "groups:assign": { sizes: number[] };
  "groups:move": undefined;
  "game:select": undefined;
  "game:configure": undefined;
  "game:control": undefined;
  "game:action": undefined;
  "game:hostAction": undefined;
  "time:sync": { clientNow: number; serverNow: number };
}

/** Typed maps for `socket.io` / `socket.io-client` generics. */
export type ClientToServerEvents = {
  [E in C2SEventName]: (payload: C2SPayload<E>, ack: (res: Ack<C2SResults[E]>) => void) => void;
};

/** state:patch carries only the top-level LobbyView keys whose value changed for this viewer. */
export type LobbyPatch = Partial<LobbyView> & { version: number };

export interface ServerToClientEvents {
  /** Full filtered snapshot: sent after display:watch / host:attach / lobby:join / session:resume. */
  "state:sync": (view: LobbyView) => void;
  /** Shallow patch of the filtered view; client merges top-level keys. */
  "state:patch": (patch: LobbyPatch) => void;
  /** Unsolicited clock beacon (also answered via the time:sync ack). */
  "time:sync": (data: { serverNow: number }) => void;
  /** Lobby closed by host or expired (LOB-07). Client clears its stored token. */
  "lobby:closed": (data: { reason: "host" | "expired" }) => void;
  /** This player was kicked (LOB-06). Client clears its stored token. */
  "session:kicked": () => void;
}

/** Shallow diff of two views → patch (used by the server; exported for tests). */
export function diffView(prev: LobbyView | undefined, next: LobbyView): LobbyPatch | null {
  if (!prev) return { ...next };
  const patch: Record<string, unknown> = {};
  let changed = false;
  for (const key of Object.keys(next) as (keyof LobbyView)[]) {
    if (key === "version") continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
      patch[key] = next[key];
      changed = true;
    }
  }
  return changed ? ({ ...patch, version: next.version } as LobbyPatch) : null;
}

/** Client-side merge of a patch into the current view. */
export function applyPatch(view: LobbyView, patch: LobbyPatch): LobbyView {
  return { ...view, ...patch };
}
