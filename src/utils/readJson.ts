import type { Context } from "hono";
import { AppError } from "./errors.js";

const MAX_CONTROL_BODY = 1024 * 1024;

export async function readJson(c: Context): Promise<unknown> {
  const text = await c.req.text();
  if (Buffer.byteLength(text) > MAX_CONTROL_BODY) {
    throw new AppError(413, "REQUEST_TOO_LARGE", "Request blocked by security policy.");
  }
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed.");
  }
}
