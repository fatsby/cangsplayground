import type { SharedDeadline } from "@cangsplayground/core";
import type { Stage } from "./types.js";

/** The deadline key encodes the stage and night so a stale wake-up for an older phase is ignored. */
export function deadlineFor(stage: Stage, night: number, endsAt: number): SharedDeadline {
  return { key: `${stage}:${night}`, endsAt };
}
