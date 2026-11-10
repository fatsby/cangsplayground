import type { SharedDeadline } from "@cangsplayground/core";
import type { Stage } from "./types.js";
import type { WerewolfShared } from "./WerewolfShared.js";

/** The deadline key encodes the stage and night so a stale wake-up for an older phase is ignored. */
/** Starts `stage`'s timer: it ends `ms` from `now`, and the length is published for the clients' timer rings. */
export function scheduleStage(shared: WerewolfShared, stage: Stage, now: number, ms: number): void {
  shared.deadline = deadlineFor(stage, shared.night, now + ms);
  shared.stageMs = ms;
}

export function deadlineFor(stage: Stage, night: number, endsAt: number): SharedDeadline {
  return { key: `${stage}:${night}`, endsAt };
}
