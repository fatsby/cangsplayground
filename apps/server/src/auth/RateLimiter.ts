/** Only failed code/token lookups consume the per-IP budget. */
export class RateLimiter {
  private failures = new Map<string, number[]>();
  constructor(private now: () => number = Date.now) {}
  private recent(ip: string) {
    return (this.failures.get(ip) ?? []).filter((t) => this.now() - t < 60000);
  }
  limited(ip: string) {
    return this.recent(ip).length >= 10;
  }
  fail(ip: string) {
    this.failures.set(ip, [...this.recent(ip), this.now()]);
  }
  sweep() {
    for (const ip of this.failures.keys()) {
      const recent = this.recent(ip);
      if (recent.length) this.failures.set(ip, recent);
      else this.failures.delete(ip);
    }
  }
}
