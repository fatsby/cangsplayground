import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Button, EmptyState, ReconnectingBanner, Waiting } from "@clubplay/ui";
import { useLobbyStore } from "../store";
import { connectRole, socket, type Role } from "../socket";
export function useRole(kind: Role["kind"], code: string, token?: string) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    if (kind !== "projector" && !token) return;
    setError("");
    const next: Role = kind === "projector" ? { kind, code } : { kind, code, token: token! };
    return connectRole(next, (result) => {
      if (
        kind === "player" &&
        (result.error.code === "NOT_FOUND" || result.error.code === "UNAUTHORIZED")
      )
        navigate(`/join/${code}`, { replace: true });
      else setError(result.error.message);
    });
  }, [kind, code, token, navigate]);
  return error;
}
export function SessionBoundary({
  children,
  code,
  error,
  projector = false,
}: {
  children: ReactNode;
  code: string;
  error?: string;
  projector?: boolean;
}) {
  const { connection, terminal, disconnectedAt } = useLobbyStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (terminal)
    return (
      <main className="mobile-screen">
        <EmptyState
          message={
            terminal === "closed"
              ? "This lobby has ended. Thanks for playing!"
              : "You were removed from the lobby"
          }
        >
          {terminal === "kicked" && (
            <Button variant="primary" onClick={() => location.assign(`/join/${code}`)}>
              Join again
            </Button>
          )}
        </EmptyState>
      </main>
    );
  if (error)
    return (
      <main className="mobile-screen">
        <EmptyState message={error}>
          <Button onClick={() => location.reload()}>Try again</Button>
        </EmptyState>
      </main>
    );
  if (!projector && disconnectedAt && now - disconnectedAt > 30000)
    return (
      <main className="mobile-screen">
        <EmptyState message="We cannot connect right now">
          <Button
            variant="primary"
            onClick={() => {
              socket.disconnect();
              socket.connect();
            }}
          >
            Try again
          </Button>
        </EmptyState>
      </main>
    );
  return (
    <>
      {connection !== "online" && <ReconnectingBanner />}
      {children}
    </>
  );
}
export function Loading() {
  return (
    <main className="mobile-screen">
      <Waiting message="Connecting to your lobby" />
    </main>
  );
}
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | undefined,
      disposed = false;
    const acquire = async () => {
      try {
        if (document.visibilityState === "visible") {
          const lock = await navigator.wakeLock.request("screen");
          if (disposed) await lock.release();
          else sentinel = lock;
        }
      } catch {
        /* Some devices do not allow screen lock. */
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      void sentinel?.release();
      document.removeEventListener("visibilitychange", acquire);
    };
  }, [active]);
}
