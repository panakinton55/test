import type { MiddlewareHandler } from "hono";
import { createId } from "../utils/ids.js";
import type { AppEnv } from "../deps.js";
import type { AppLogger } from "../utils/logger.js";

export function requestContext(logger: AppLogger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = createId("req");
    c.set("requestId", requestId);
    c.set("logger", logger.child({ requestId }));
    c.header("X-Request-Id", requestId);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    await next();
  };
}
