import { clockSample } from "@clubplay/core";
export type ClockSample = ReturnType<typeof clockSample>;
export function bestClockSample(
  previous: ClockSample | null,
  sent: number,
  server: number,
  received: number,
): ClockSample {
  const sample = clockSample(sent, server, received);
  return !previous || sample.rtt < previous.rtt ? sample : previous;
}
