import { z } from "zod";

/** Payload shared by every "pick a player" action. */
export const targetPayload = z.object({ targetId: z.string().min(1) });
