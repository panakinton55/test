export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
};

type Bucket = { count: number; resetAt: number };

export function createMemoryRateLimiter(now: () => Date = () => new Date()): RateLimiter {
  const buckets = new Map<string, Bucket>();
  return {
    async consume(key, limit, windowSeconds) {
      const time = now().getTime();
      const current = buckets.get(key);
      if (!current || current.resetAt <= time) {
        buckets.set(key, { count: 1, resetAt: time + windowSeconds * 1000 });
        return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: windowSeconds };
      }
      current.count += 1;
      return {
        allowed: current.count <= limit,
        remaining: Math.max(0, limit - current.count),
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - time) / 1000)),
      };
    },
  };
}

export type RedisLike = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  eval(script: string, numkeys: number, ...args: Array<string | number>): Promise<unknown>;
};

export function createRedisRateLimiter(redis: RedisLike, now: () => Date = () => new Date()): RateLimiter {
  return {
    async consume(key, limit, windowSeconds) {
      // TODO(security): replace this fixed window with a sliding window before multi-tenant production traffic.
      const bucket = Math.floor(now().getTime() / 1000 / windowSeconds);
      const redisKey = `rl:${key}:${bucket}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, windowSeconds + 1);
      const ttl = await redis.ttl(redisKey);
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    },
  };
}
