import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { assertRuntimeConfig, loadConfig } from "./config/index.js";
import { loadEnvFile } from "./config/loadEnvFile.js";
import { createNoopAlertSink, createWebhookAlertSink } from "./core/alertSink.js";
import { createFetchProxyClient } from "./core/proxyClient.js";
import { createMemoryRateLimiter, createRedisRateLimiter, type RedisLike } from "./core/rateLimiter.js";
import { createMemoryStore } from "./db/memoryStore.js";
import type { DataStore } from "./db/store.js";
import { createInternalIdentity } from "./identity/index.js";
import { createMemoryReplayStore, createRedisReplayStore, type RedisEval } from "./identity/replayStore.js";
import { createLogger } from "./utils/logger.js";

loadEnvFile();

const config = loadConfig();
assertRuntimeConfig(config);
const logger = createLogger(config.logLevel);
const runtime = await createRuntime();
const app = createApp({
  config,
  logger,
  store: runtime.store,
  rateLimiter: runtime.rateLimiter,
  identity: createInternalIdentity({
    store: runtime.store,
    replay: runtime.replay,
    ttlSeconds: config.proofTtlSeconds,
  }),
  proxyClient: createFetchProxyClient(),
  alertSink: config.alertWebhookUrl ? createWebhookAlertSink(config.alertWebhookUrl) : createNoopAlertSink(),
  now: () => new Date(),
});

const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port: config.port }, (info) => {
  logger.info({ port: info.port, storage: config.storage, redis: Boolean(config.redisUrl) }, "gateway listening");
});

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  await runtime.close();
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

async function createRuntime(): Promise<{
  store: DataStore;
  rateLimiter: ReturnType<typeof createMemoryRateLimiter>;
  replay: ReturnType<typeof createMemoryReplayStore>;
  close: () => Promise<void>;
}> {
  if (!config.adminApiKey) logger.warn("ADMIN_API_KEY is not set. Tenant provisioning is disabled.");
  let store: DataStore;
  let closeStore = async (): Promise<void> => {};
  if (config.storage === "memory") {
    logger.warn("STORAGE=memory keeps data only in this process. Use PostgreSQL outside a local trial.");
    store = createMemoryStore();
  } else {
    const { PrismaClient } = await import("@prisma/client");
    const { createPrismaStore } = await import("./db/prismaStore.js");
    const prisma = new PrismaClient();
    store = createPrismaStore(prisma);
    closeStore = async () => {
      await prisma.$disconnect();
    };
  }

  if (!config.redisUrl) {
    logger.warn("REDIS_URL is not set. Rate limits and replay protection stay in this process.");
    return { store, rateLimiter: createMemoryRateLimiter(), replay: createMemoryReplayStore(), close: closeStore };
  }

  const { Redis } = await import("ioredis");
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
  const client = redis as unknown as RedisLike & RedisEval;
  return {
    store,
    rateLimiter: createRedisRateLimiter(client),
    replay: createRedisReplayStore(client),
    async close() {
      redis.disconnect();
      await closeStore();
    },
  };
}
