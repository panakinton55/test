export class NonceStore {
  private readonly seen = new Map<string, number>();

  put(key: string, expiresAt: number, now: number): boolean {
    if (this.seen.size > 10_000) {
      for (const [entry, expiry] of this.seen) {
        if (expiry <= now) this.seen.delete(entry);
      }
    }
    const existing = this.seen.get(key);
    if (existing !== undefined && existing > now) return false;
    this.seen.set(key, expiresAt);
    return true;
  }
}

export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; ts: number }>();

  constructor(
    private readonly perMin: number,
    private readonly burst: number,
  ) {}

  allow(key: string, now: number): boolean {
    if (this.perMin <= 0) return true;
    const refillPerMs = this.perMin / 60_000;
    const bucket = this.buckets.get(key) ?? { tokens: this.burst, ts: now };
    const elapsed = Math.max(0, now - bucket.ts);
    bucket.tokens = Math.min(this.burst, bucket.tokens + elapsed * refillPerMs);
    bucket.ts = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}
