import type { Hono } from "hono";
import type { AppDependencies, AppEnv } from "../deps.js";
import { requireAdmin } from "../middleware/auth.js";
import { tenantCreateSchema } from "../openapi/schemas.js";
import { parseBody } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { readJson } from "../utils/readJson.js";

export function registerTenantRoutes(app: Hono<AppEnv>, deps: AppDependencies): void {
  app.post("/v1/tenants", async (c) => {
    requireAdmin(c, deps.config);
    const body = parseBody(tenantCreateSchema, await readJson(c));
    const tenant = await deps.store.createTenant({
      id: createId("ten"),
      companyName: body.company_name,
      adminEmail: body.admin_email,
      plan: body.plan,
      createdAt: deps.now(),
    });
    return c.json(
      {
        tenant_id: tenant.id,
        company_name: tenant.companyName,
        admin_email: tenant.adminEmail,
        plan: tenant.plan,
        created_at: tenant.createdAt.toISOString(),
      },
      201,
    );
  });
}
