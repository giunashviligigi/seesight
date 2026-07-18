import { createHash } from 'crypto';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly ttlMs: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  static hashKey(parts: Record<string, unknown>): string {
    return createHash('sha256')
      .update(JSON.stringify(parts))
      .digest('hex');
  }
}

type RateBucket = {
  windowStart: number;
  count: number;
};

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(private readonly limitPerMinute: number) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
      this.buckets.set(key, { windowStart: now, count: 1 });
      return true;
    }

    if (bucket.count >= this.limitPerMinute) {
      return false;
    }

    bucket.count += 1;
    return true;
  }
}
