import type { SharedArgs, Viewer } from "@cangsplayground/core";
import type { WerewolfShared } from "./WerewolfShared.js";
import type { WerewolfConfig } from "./types.js";

/** Everything a reducer may read besides the shared state itself. */
export type Context = Omit<SharedArgs<WerewolfConfig, WerewolfShared>, "shared"> & { actor: Viewer };

/** A reducer gets a private clone of the state; returning null rejects the action. */
export type Reducer = (shared: WerewolfShared, ctx: Context, payload: unknown) => WerewolfShared | null;

export const isHost = (ctx: Pick<Context, "actor">): boolean => ctx.actor.kind === "host";
