import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { AppEnv } from "../deps.js";
import { AppError } from "../utils/errors.js";

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  const requestId = readRequestId(c);
  const logger = readLogger(c);
  if (err instanceof AppError) {
    logger?.warn({ code: err.code, status: err.status, requestId }, "request rejected");
    return c.json(
      {
        request_id: requestId,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.status as ContentfulStatusCode,
    );
  }
  if (err instanceof ZodError) {
    return c.json({ request_id: requestId, error: { code: "VALIDATION_ERROR", message: "Validation failed." } }, 400);
  }
  logger?.error({ name: err.name, requestId }, "unhandled error");
  return c.json({ request_id: requestId, error: { code: "INTERNAL_ERROR", message: "The request could not be processed." } }, 500);
}

function readRequestId(c: Context<AppEnv>): string {
  try {
    return c.get("requestId") || "req_unknown";
  } catch {
    return "req_unknown";
  }
}

function readLogger(c: Context<AppEnv>) {
  try {
    return c.get("logger");
  } catch {
    return undefined;
  }
}
