import pino, { type Logger } from "pino";
import { GATEWAY_VERSION } from "../domain.js";

export type AppLogger = Logger;

export function createLogger(level: string): AppLogger {
  return pino({
    level,
    base: { service: "agentsecure-gateway", version: GATEWAY_VERSION },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers['x-api-key']",
        "req.headers['x-admin-key']",
        "api_key",
        "apiKey",
        "authorization",
        "privateKey",
        "private_key",
        "password",
        "body",
        "headers",
        "*.api_key",
        "*.authorization",
        "*.privateKey",
        "*.body",
        "*.headers",
      ],
      censor: "[Redacted]",
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}
