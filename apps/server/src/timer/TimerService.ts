import type { Lobby } from "../lobby/Lobby.js";
export class TimerService {
  private timers = new Map<string, { endsAt: number; handle: ReturnType<typeof setTimeout> }>();
  constructor(private now: () => number = Date.now) {}
  reconcile(lobby: Lobby) {
    const wanted = new Set<string>();
    if (lobby.status === "open")
      for (const group of lobby.game?.groups ?? []) {
        if (group.phase !== "RUNNING" || group.timer.endsAt === null) continue;
        const key = `${lobby.code}:${group.groupId}`;
        wanted.add(key);
        const endsAt = group.timer.endsAt;
        const existing = this.timers.get(key);
        if (existing?.endsAt === endsAt) continue;
        if (existing) clearTimeout(existing.handle);
        const handle = setTimeout(
          () => {
            this.timers.delete(key);
            lobby.expire(group.groupId, endsAt);
          },
          Math.max(0, endsAt - this.now()),
        );
        handle.unref?.();
        this.timers.set(key, { endsAt, handle });
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
