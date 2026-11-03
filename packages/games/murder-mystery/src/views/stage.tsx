import type { CSSProperties, ReactNode } from "react";
import { isStaged } from "./timeline.js";

type Tag = "li" | "div" | "p" | "dd" | "g" | "text";

/**
 * One staged element on a shared timeline. `--d` is its delay in seconds; CSS animates it using
 * `calc(var(--d) - var(--mm-elapsed))`, and `data-pending` mirrors the same elapsed time so a test
 * or screen reader sees what is currently on screen.
 *
 * @param d delay in seconds from the start of the sequence.
 * @param elapsed elapsed ms of the sequence, or null before it starts.
 * @param reduced reduced motion shows everything at once.
 */
export function Stage({
  d,
  elapsed,
  reduced,
  as = "li",
  children,
  className = "",
  part,
  ...rest
}: {
  d: number;
  elapsed: number | null;
  reduced: boolean;
  as?: Tag;
  children: ReactNode;
  className?: string;
  /** Name of the part for tests and styling (`data-part`). */
  part?: string;
} & Record<string, unknown>) {
  const pending = !isStaged(d, elapsed, reduced);
  const Component = as as "div";
  return (
    <Component
      {...(rest as object)}
      className={`mm-stage ${className}`.trim()}
      style={{ ["--d" as string]: d } as CSSProperties}
      data-part={part}
      data-pending={pending ? "true" : undefined}
      aria-hidden={pending ? true : undefined}
    >
      {children}
    </Component>
  );
}
