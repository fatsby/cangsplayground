import { z } from "zod";

/** Allowed range and step, in seconds, shared by every configurable phase length. */
export const LIMITS = { min: 30, max: 600, step: 30 } as const;

const seconds = (fallback: number) =>
  z
    .number()
    .int()
    .min(LIMITS.min)
    .max(LIMITS.max)
    .refine((value) => value % LIMITS.step === 0, {
      message: `must be a multiple of ${LIMITS.step}`,
    })
    .default(fallback);

/**
 * Host-editable phase lengths. Defaults give the classroom flow: 2 min briefing, 3 min sharing,
 * four 3 min investigation rounds, 4 min conclusion. The fixed intro is not configurable.
 */
export const configSchema = z.object({
  briefingSeconds: seconds(120),
  sharingSeconds: seconds(180),
  investigationSeconds: seconds(180),
  conclusionSeconds: seconds(240),
});

/** Validated host configuration for one murder-mystery session. */
export type MurderConfig = z.infer<typeof configSchema>;
