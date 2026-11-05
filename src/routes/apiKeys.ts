import type { Hono } from "hono";
import type { AppDependencies, AppEnv } from "../deps.js";
import { requireAdmin, requireApiKey } from "../middleware/auth.js";
import { apiKeyCreateSchema } from "../openapi/schemas.js";
import { AppError, parseBody } from "../utils/errors.js";
import { createId, generateApiKey } from "../utils/ids.js";
import { readJson } from "../utils/readJson.js";

export function registerApiKeyRoutes(app: Hono<AppEnv>, deps: AppDependencies): void {
  app.post("/v1/api-keys", async (c) => {
    const body = parseBody(apiKeyCreateSchema, await readJson(c));
    const tenantId = await resolveTenantId(c, deps, body.tenant_id);
    const generated = generateApiKey();
    const record = await deps.store.createApiKey({
      id: createId("key"),
      tenantId,
      name: body.name ?? "default",
      keyHash: generated.hash,
      prefix: generated.prefix,
      createdAt: deps.now(),
      revokedAt: null,
    });
    return c.json(
      {
        api_key_id: record.id,
        api_key: generated.plaintext,
        prefix: record.prefix,
        message: "Store this key now. It cannot be shown again.",
      },
      201,
    );
  });
}

async function resolveTenantId(c: Parameters<typeof requireAdmin>[0], deps: AppDependencies, requested?: string): Promise<string> {
  if (c.req.header("x-admin-key")) {
    requireAdmin(c, deps.config);
    if (!requested) throw new AppError(400, "VALIDATION_ERROR", "Validation failed.", [{ path: "tenant_id", code: "custom" }]);
    const tenant = await deps.store.findTenant(requested);
    if (!tenant) throw new AppError(404, "TENANT_NOT_FOUND", "Tenant was not found.");
    return tenant.id;
  }
  const auth = await requireApiKey(c, deps.store);
  if (requested && requested !== auth.tenant.id) {
    throw new AppError(403, "FORBIDDEN", "Request blocked by security policy.");
  }
  return auth.tenant.id;
}
