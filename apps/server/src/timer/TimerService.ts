import type { Lobby } from "../lobby/Lobby.js";
export class TimerService {
  private timers = new Map<string, { endsAt: number; handle: ReturnType<typeof setTimeout> }>();
  constructor(private now: () => number = Date.now) {}
  reconcile(lobby: Lobby) {
    const wanted = new Set<string>();
    const schedule = (key: string, endsAt: number, expire: () => void) => {
      wanted.add(key);
      const existing = this.timers.get(key);
      if (existing?.endsAt === endsAt) return;
      if (existing) clearTimeout(existing.handle);
      const handle = setTimeout(
        () => {
          this.timers.delete(key);
          expire();
        },
        Math.max(0, endsAt - this.now()),
      );
      handle.unref?.();
      this.timers.set(key, { endsAt, handle });
    };
    if (lobby.status === "open") {
      const clock = lobby.game?.clock;
      if (clock && !clock.done && clock.timer.endsAt !== null) {
        const endsAt = clock.timer.endsAt;
        schedule(`${lobby.code}:clock`, endsAt, () => lobby.expireClock(endsAt));
      }
      for (const group of lobby.game?.groups ?? []) {
        if ((group.phase !== "RUNNING" && group.phase !== "VOTING") || group.timer.endsAt === null)
          continue;
        const endsAt = group.timer.endsAt;
        schedule(`${lobby.code}:${group.groupId}`, endsAt, () => {
          // The session deadline wins over a simultaneous vote/turn deadline.
          const deadline = lobby.game?.clock?.timer.endsAt;
          if (deadline !== null && deadline !== undefined && deadline <= this.now())
            lobby.expireClock(deadline);
          else lobby.expire(group.groupId, endsAt);
        });
      }
    }
    for (const [key, timer] of this.timers)
      if (key.startsWith(`${lobby.code}:`) && !wanted.has(key)) {
        clearTimeout(timer.handle);
        this.timers.delete(key);
      }
  }
  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer.handle);
    this.timers.clear();
  }
}
