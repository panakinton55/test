import { z } from "zod";
import { GATEWAY_VERSION } from "../domain.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  STORAGE: z.enum(["memory", "prisma"]).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  ADMIN_API_KEY: z.string().min(16).optional(),
  IP_HASH_SALT: z.string().min(16).default("dev-only-change-me-please-00"),
  ALLOW_INSECURE_UPSTREAM: z.enum(["true", "false"]).default("false"),
  PROOF_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(300),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: string;
  storage: "memory" | "prisma";
  databaseUrl?: string;
  redisUrl?: string;
  adminApiKey?: string;
  ipHashSalt: string;
  allowInsecureUpstream: boolean;
  proofTtlSeconds: number;
  alertWebhookUrl?: string;
  gatewayVersion: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "env").join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  const value = parsed.data;
  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    logLevel: value.LOG_LEVEL,
    storage: value.STORAGE ?? (value.DATABASE_URL ? "prisma" : "memory"),
    databaseUrl: value.DATABASE_URL,
    redisUrl: value.REDIS_URL,
    adminApiKey: value.ADMIN_API_KEY,
    ipHashSalt: value.IP_HASH_SALT,
    allowInsecureUpstream: value.ALLOW_INSECURE_UPSTREAM === "true",
    proofTtlSeconds: value.PROOF_TTL_SECONDS,
    alertWebhookUrl: value.ALERT_WEBHOOK_URL,
    gatewayVersion: GATEWAY_VERSION,
  };
}

export function assertRuntimeConfig(config: AppConfig): void {
  if (config.nodeEnv !== "production") return;
  const problems: string[] = [];
  if (config.storage !== "prisma" || !config.databaseUrl) {
    problems.push("DATABASE_URL and STORAGE=prisma are required");
  }
  if (!config.redisUrl) problems.push("REDIS_URL is required");
  if (!config.adminApiKey) problems.push("ADMIN_API_KEY is required");
  if (looksLikePlaceholder(config.ipHashSalt)) problems.push("IP_HASH_SALT must be replaced");
  if (config.adminApiKey && looksLikePlaceholder(config.adminApiKey)) {
    problems.push("ADMIN_API_KEY must be replaced");
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production: ${problems.join("; ")}`);
  }
}

function looksLikePlaceholder(value: string): boolean {
  const lowered = value.toLowerCase();
  return lowered.includes("change-me") || lowered.includes("replace-with") || lowered.includes("example");
}
