import type { Lobby, Session } from "../lobby/Lobby.js";
interface Scheduled {
  endsAt: number;
  /** Shared deadlines are bound to the session that exported them. */
  owner: Session | null;
  handle: ReturnType<typeof setTimeout>;
}
export class TimerService {
  private timers = new Map<string, Scheduled>();
  constructor(private now: () => number = Date.now) {}
  reconcile(lobby: Lobby) {
    const wanted = new Set<string>();
    const schedule = (key: string, endsAt: number, expire: () => void, owner: Session | null) => {
      wanted.add(key);
      const existing = this.timers.get(key);
      if (existing?.endsAt === endsAt && existing.owner === owner) return;
      if (existing) clearTimeout(existing.handle);
      const record: Scheduled = {
        endsAt,
        owner,
        handle: setTimeout(
          () => {
            // A replacement scheduled under the same key keeps its own record.
            if (this.timers.get(key) === record) this.timers.delete(key);
            expire();
          },
          Math.max(0, endsAt - this.now()),
        ),
      };
      record.handle.unref?.();
      this.timers.set(key, record);
    };
    if (lobby.status === "open") {
      const clock = lobby.game?.clock;
      if (clock && !clock.done && clock.timer.endsAt !== null) {
        const endsAt = clock.timer.endsAt;
        schedule(`${lobby.code}:clock`, endsAt, () => lobby.expireClock(endsAt), null);
      }
      for (const group of lobby.game?.groups ?? []) {
        if ((group.phase !== "RUNNING" && group.phase !== "VOTING") || group.timer.endsAt === null)
          continue;
        const endsAt = group.timer.endsAt;
        schedule(
          `${lobby.code}:${group.groupId}`,
          endsAt,
          () => {
            // The session deadline wins over a simultaneous vote/turn deadline.
            const deadline = lobby.game?.clock?.timer.endsAt;
            if (deadline !== null && deadline !== undefined && deadline <= this.now())
              lobby.expireClock(deadline);
            else lobby.expire(group.groupId, endsAt);
          },
          null,
        );
      }
      const session = lobby.game;
      if (session)
        for (const deadline of lobby.sharedDeadlines())
          schedule(
            `${lobby.code}:shared:${deadline.key}`,
            deadline.endsAt,
            () => {
              // A callback that fires a little early re-arms through reconcile.
              if (!lobby.expireSharedDeadline(session, deadline) && this.now() < deadline.endsAt)
                this.reconcile(lobby);
            },
            session,
          );
    }
    for (const [key, timer] of this.timers)
      if (key.startsWith(`${lobby.code}:`) && !wanted.has(key)) {
        clearTimeout(timer.handle);
        this.timers.delete(key);
      }
  }
  /** Scheduled keys, for tests. */
  keys(): string[] {
    return [...this.timers.keys()];
  }
  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer.handle);
    this.timers.clear();
  }
}
