import type { Context } from "hono";
import type { AppConfig } from "../config/index.js";
import type { ApiKeyRecord, TenantRecord } from "../domain.js";
import type { DataStore } from "../db/store.js";
import { AppError } from "../utils/errors.js";
import { safeEqual } from "../utils/hash.js";
import { hashApiKey } from "../utils/ids.js";

export type AuthContext = {
  tenant: TenantRecord;
  apiKey: ApiKeyRecord;
  presentedKey: string;
};

export async function requireApiKey(c: Context, store: DataStore): Promise<AuthContext> {
  const header = c.req.header("x-api-key")?.trim() ?? "";
  const authorization = c.req.header("authorization") ?? "";
  let token = header;
  if (!token && authorization.toLowerCase().startsWith("bearer ")) {
    token = authorization.slice(7).trim();
  }
  if (!token) throw new AppError(401, "INVALID_API_KEY", "Invalid API key.");
  const found = await store.findApiKeyByHash(hashApiKey(token));
  if (!found || found.apiKey.revokedAt) throw new AppError(401, "INVALID_API_KEY", "Invalid API key.");
  return { tenant: found.tenant, apiKey: found.apiKey, presentedKey: token };
}

export function requireAdmin(c: Context, config: AppConfig): void {
  const provided = c.req.header("x-admin-key") ?? "";
  if (!config.adminApiKey || !safeEqual(provided, config.adminApiKey)) {
    throw new AppError(401, "INVALID_ADMIN_KEY", "Admin authentication failed.");
  }
}

export function clientIp(c: Context): string {
  // TODO(security): trust X-Forwarded-For only when the peer is a configured proxy.
  const forwarded = c.req.header("x-forwarded-for");
  if (!forwarded) return "0.0.0.0";
  return forwarded.split(",")[0]?.trim().slice(0, 64) || "0.0.0.0";
}
