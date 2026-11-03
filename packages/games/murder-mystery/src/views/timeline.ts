import { useEffect, useState, type CSSProperties } from "react";

/** Length of the projector's solution story after Reveal. */
export const REVEAL_STORY_MS = 16_000;
/** Pause between the solution story and the scoreboard; no host control, no server deadline. */
export const REVEAL_HOLD_MS = 2_000;
/** Length of the projector's scoreboard sequence. */
export const REVEAL_BOARD_MS = 14_000;
/** The whole reveal sequence. */
export const REVEAL_TOTAL_MS = REVEAL_STORY_MS + REVEAL_HOLD_MS + REVEAL_BOARD_MS;
/** Elapsed offset (ms) at which the scoreboard begins. */
export const REVEAL_BOARD_START_MS = REVEAL_STORY_MS + REVEAL_HOLD_MS;

/** A value far beyond any timeline: reduced motion jumps straight to the final frame. */
const PAST_THE_END_SECONDS = 9_999;

/** Where an animated sequence gets its time from. */
export type ElapsedSource = {
  /** Total length of the sequence, in ms. */
  totalMs: number;
  /** Server time at which the sequence started, or null before it starts. */
  startedAt: number | null;
  serverNow: () => number;
  /** When set, the sequence is frozen at this elapsed time (the intro while paused). */
  frozenAtMs?: number | null;
};

const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

/**
 * Elapsed time of a sequence as a pure function of the server clock, so a reload or a late join
 * lands on the right frame. One animation-frame loop runs per sequence and stops at the end.
 *
 * @returns null before the sequence starts; otherwise ms since the start, clamped to
 *   `[0, totalMs]`, or `frozenAtMs` while frozen.
 */
export function useElapsedMs(source: ElapsedSource): number | null {
  const { totalMs, startedAt, serverNow, frozenAtMs } = source;
  const compute = (): number | null => {
    if (startedAt === null) return null;
    if (frozenAtMs !== undefined && frozenAtMs !== null) return clamp(frozenAtMs, totalMs);
    return clamp(serverNow() - startedAt, totalMs);
  };
  const [elapsed, setElapsed] = useState<number | null>(compute);

  useEffect(() => {
    setElapsed(compute());
    if (startedAt === null || (frozenAtMs !== undefined && frozenAtMs !== null)) return;
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    const cancel = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : null;
    let handle: number | ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const next = compute();
      setElapsed(next);
      if (next !== null && next >= totalMs) return;
      handle = raf ? raf(loop) : setTimeout(loop, 16);
    };
    handle = raf ? raf(loop) : setTimeout(loop, 16);
    return () => {
      stopped = true;
      if (handle === undefined) return;
      if (raf && cancel) cancel(handle as number);
      else clearTimeout(handle as ReturnType<typeof setTimeout>);
    };
    // `compute` closes over the same inputs listed here.
  }, [totalMs, startedAt, serverNow, frozenAtMs]);

  return elapsed;
}

/** Whether the system asks for reduced motion. False where `matchMedia` is unavailable. */
export function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const read = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => setReduced(list.matches);
    onChange();
    list.addEventListener?.("change", onChange);
    return () => list.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * Style that sets the CSS custom property `--mm-elapsed` (seconds). Every staged element delays
 * its animation by `calc(var(--d) - var(--mm-elapsed))`, so a late mount seeks to the right frame.
 *
 * @param elapsedMs elapsed time, or null before the sequence starts.
 * @param reduced when true the value is far past the end, so CSS shows the final frame.
 */
export function elapsedStyle(elapsedMs: number | null, reduced: boolean): CSSProperties {
  const seconds = reduced ? PAST_THE_END_SECONDS : (elapsedMs ?? 0) / 1000;
  return { ["--mm-elapsed" as string]: seconds } as CSSProperties;
}

/**
 * A number that counts up to `target` during `[startMs, startMs + durationMs]`.
 *
 * @returns 0 before the window, `target` from its end on, and a whole number in between;
 *   monotonic in `elapsedMs`.
 */
export function countUpValue(
  target: number,
  elapsedMs: number,
  startMs: number,
  durationMs: number,
): number {
  if (elapsedMs <= startMs) return 0;
  if (durationMs <= 0 || elapsedMs >= startMs + durationMs) return target;
  return Math.round((target * (elapsedMs - startMs)) / durationMs);
}

/**
 * Whether a staged item with delay `delaySeconds` is already on screen.
 *
 * @param elapsedMs elapsed time, or null before the sequence starts.
 * @param reduced reduced motion shows everything.
 */
export function isStaged(
  delaySeconds: number,
  elapsedMs: number | null,
  reduced: boolean,
): boolean {
  if (reduced) return true;
  return elapsedMs !== null && elapsedMs / 1000 >= delaySeconds;
}
