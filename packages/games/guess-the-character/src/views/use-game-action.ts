import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction } from "@cangsplayground/core";
import type { SessionViewProps } from "@cangsplayground/ui";

export const ACTION_TIMEOUT_MS = 5000;
export const RETRY_MESSAGE = "That didn't work. Please try again.";
export const NO_REPLY_MESSAGE = "No reply. Check your connection and try again.";

/**
 * One player action at a time. A rejection, a false ack or no reply within 5 s releases
 * the pending state and shows a retry message; nothing is retried automatically.
 */
export function useGameAction(act: SessionViewProps["act"]) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The action type the error belongs to, so it shows beside that control. */
  const [failedType, setFailedType] = useState<string | null>(null);
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const send = useCallback(
    async (action: GameAction): Promise<boolean> => {
      if (!act) return false;
      const id = ++latest.current;
      setPending(true);
      setError(null);
      setFailedType(null);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let result: boolean | "no-reply";
      try {
        result = await Promise.race([
          act(action),
          new Promise<"no-reply">((resolve) => {
            timeout = setTimeout(() => resolve("no-reply"), ACTION_TIMEOUT_MS);
          }),
        ]);
      } catch {
        result = "no-reply";
      } finally {
        clearTimeout(timeout);
      }
      const ok = result === true;
      // A newer send or an unmount owns the state now.
      if (!mounted.current || id !== latest.current) return ok;
      setPending(false);
      if (!ok) {
        setError(result === "no-reply" ? NO_REPLY_MESSAGE : RETRY_MESSAGE);
        setFailedType(action.type);
      }
      return ok;
    },
    [act],
  );
  const clearError = useCallback(() => {
    setError(null);
    setFailedType(null);
  }, []);
  return { pending, error, failedType, send, clearError };
}
