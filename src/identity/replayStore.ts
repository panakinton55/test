export type ReplayStore = {
  issue(requestId: string, ttlSeconds: number): Promise<void>;
  consume(requestId: string): Promise<"ok" | "replay" | "unknown">;
};

type Entry = { state: "issued" | "used"; expiresAt: number };

export function createMemoryReplayStore(now: () => Date = () => new Date()): ReplayStore {
  const entries = new Map<string, Entry>();
  return {
    async issue(requestId, ttlSeconds) {
      const time = now().getTime();
      const current = entries.get(requestId);
      if (current && current.expiresAt > time) {
        throw new Error("replay");
      }
      entries.set(requestId, { state: "issued", expiresAt: time + ttlSeconds * 1000 });
    },
    async consume(requestId) {
      const time = now().getTime();
      const current = entries.get(requestId);
      if (!current || current.expiresAt <= time) return "unknown";
      if (current.state === "used") return "replay";
      current.state = "used";
      return "ok";
    },
  };
}

export type RedisEval = {
  eval(script: string, numkeys: number, ...args: Array<string | number>): Promise<unknown>;
};

const ISSUE_SCRIPT = `
if redis.call('exists', KEYS[1]) == 1 then return 0 end
redis.call('set', KEYS[1], 'issued', 'EX', ARGV[1])
return 1
`;

const CONSUME_SCRIPT = `
local value = redis.call('get', KEYS[1])
if not value then return 'unknown' end
if value == 'used' then return 'replay' end
if value == 'issued' then
  redis.call('set', KEYS[1], 'used', 'KEEPTTL')
  return 'ok'
end
return 'unknown'
`;

export function createRedisReplayStore(redis: RedisEval): ReplayStore {
  return {
    async issue(requestId, ttlSeconds) {
      const result = await redis.eval(ISSUE_SCRIPT, 1, `proof:${requestId}`, ttlSeconds);
      if (result !== 1) throw new Error("replay");
    },
    async consume(requestId) {
      const result = await redis.eval(CONSUME_SCRIPT, 1, `proof:${requestId}`);
      if (result === "ok" || result === "replay" || result === "unknown") return result;
      return "unknown";
    },
  };
}
