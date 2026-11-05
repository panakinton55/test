import type { AppConfig } from "./config/index.js";
import type { AlertSink } from "./core/alertSink.js";
import type { ProxyClient } from "./core/proxyClient.js";
import type { RateLimiter } from "./core/rateLimiter.js";
import type { DataStore } from "./db/store.js";
import type { InternalIdentity } from "./identity/index.js";
import type { AppLogger } from "./utils/logger.js";

export type AppEnv = {
  Variables: {
    requestId: string;
    logger: AppLogger;
  };
};

export type AppDependencies = {
  config: AppConfig;
  logger: AppLogger;
  store: DataStore;
  rateLimiter: RateLimiter;
  identity: InternalIdentity;
  proxyClient: ProxyClient;
  alertSink: AlertSink;
  now: () => Date;
};
