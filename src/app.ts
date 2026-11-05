import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import type { AppDependencies, AppEnv } from "./deps.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestContext } from "./middleware/requestContext.js";
import { openApiDocument } from "./openapi/document.js";
import { registerApiKeyRoutes } from "./routes/apiKeys.js";
import { registerAuditRoutes } from "./routes/auditLogs.js";
import { registerGatewayRoutes } from "./routes/gateway.js";
import { registerPolicyRoutes } from "./routes/policies.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { AppError } from "./utils/errors.js";

const HARD_BODY_LIMIT = 5 * 1024 * 1024;

export function createApp(deps: AppDependencies): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", requestContext(deps.logger));
  app.use("*", async (c, next) => {
    // TODO(security): enforce this limit while streaming so an omitted content-length cannot exhaust memory.
    const length = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(length) && length > HARD_BODY_LIMIT) {
      throw new AppError(413, "REQUEST_TOO_LARGE", "Request blocked by security policy.");
    }
    await next();
  });
  app.onError(errorHandler);
  app.notFound((c) =>
    c.json({ request_id: c.get("requestId"), error: { code: "NOT_FOUND", message: "The requested resource was not found." } }, 404),
  );
  app.get("/health", (c) => c.json({ status: "ok", version: deps.config.gatewayVersion }));
  app.get("/openapi.json", (c) => c.json(openApiDocument));
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));
  registerTenantRoutes(app, deps);
  registerApiKeyRoutes(app, deps);
  registerPolicyRoutes(app, deps);
  registerGatewayRoutes(app, deps);
  registerAuditRoutes(app, deps);
  return app;
}
