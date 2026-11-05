import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/index.js";
import type { AuditLogRecord } from "../src/domain.js";
import { createMemoryRateLimiter } from "../src/core/rateLimiter.js";
import type { ProxyForward, ProxyResult } from "../src/core/proxyClient.js";
import { createMemoryStore } from "../src/db/memoryStore.js";
import { createInternalIdentity } from "../src/identity/index.js";
import { createMemoryReplayStore } from "../src/identity/replayStore.js";
import { createLogger } from "../src/utils/logger.js";

export const ADMIN_KEY = "test-admin-key-0123456789";

export function createTestApp() {
  const store = createMemoryStore();
  const calls: ProxyForward[] = [];
  const responders: Array<(input: ProxyForward) => ProxyResult | Promise<ProxyResult>> = [];
  const alerts: AuditLogRecord[] = [];
  const config = loadConfig({
    NODE_ENV: "test",
    STORAGE: "memory",
    ADMIN_API_KEY: ADMIN_KEY,
    IP_HASH_SALT: "test-ip-hash-salt-012345",
    LOG_LEVEL: "silent",
    ALLOW_INSECURE_UPSTREAM: "false",
    PROOF_TTL_SECONDS: "300",
  });
  const identity = createInternalIdentity({
    store,
    replay: createMemoryReplayStore(),
    ttlSeconds: config.proofTtlSeconds,
  });
  const app = createApp({
    config,
    logger: createLogger("silent"),
    store,
    rateLimiter: createMemoryRateLimiter(),
    identity,
    proxyClient: {
      async forward(input) {
        calls.push(input);
        const responder = responders.shift();
        if (responder) return responder(input);
        return { status: 200, bodyText: JSON.stringify({ ok: true, echoed: input.proof }) };
      },
    },
    alertSink: {
      async notify(entry) {
        alerts.push(entry);
      },
    },
    now: () => new Date(),
  });
  return { app, store, config, calls, responders, alerts, identity };
}

export async function provision(app: ReturnType<typeof createTestApp>["app"], plan = "business") {
  const tenantResponse = await app.request("/v1/tenants", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ company_name: "アクロ商事", admin_email: "admin@example.com", plan }),
  });
  const tenant = (await tenantResponse.json()) as { tenant_id: string };
  const keyResponse = await app.request("/v1/api-keys", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({ tenant_id: tenant.tenant_id, name: "trial" }),
  });
  const key = (await keyResponse.json()) as { api_key: string; prefix: string; api_key_id: string };
  return { tenant, key, tenantResponse, keyResponse };
}

export function authHeaders(apiKey: string): Record<string, string> {
  return { "content-type": "application/json", "x-api-key": apiKey };
}
