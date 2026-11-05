import type { Hono } from "hono";
import type { AuditCursor, AuditLogRecord } from "../domain.js";
import type { AppDependencies, AppEnv } from "../deps.js";
import { requireApiKey } from "../middleware/auth.js";
import { auditQuerySchema } from "../openapi/schemas.js";
import { AppError, parseBody } from "../utils/errors.js";

export function registerAuditRoutes(app: Hono<AppEnv>, deps: AppDependencies): void {
  app.get("/v1/audit-logs", async (c) => {
    const auth = await requireApiKey(c, deps.store);
    const query = parseBody(auditQuerySchema, {
      from: c.req.query("from"),
      to: c.req.query("to"),
      action: c.req.query("action"),
      reason_code: c.req.query("reason_code"),
      limit: c.req.query("limit") ?? undefined,
      cursor: c.req.query("cursor"),
    });
    const page = await deps.store.listAuditLogs({
      tenantId: auth.tenant.id,
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.reason_code ? { reasonCode: query.reason_code } : {}),
      limit: query.limit,
      ...(query.cursor ? { cursor: decodeCursor(query.cursor) } : {}),
    });
    return c.json({
      request_id: c.get("requestId"),
      data: page.items.map(presentAudit),
      next_cursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  });
}

function presentAudit(entry: AuditLogRecord) {
  return {
    request_id: entry.requestId,
    agent_id: entry.agentId,
    policy_id: entry.policyId,
    timestamp: entry.timestamp.toISOString(),
    source_ip_hash: entry.sourceIpHash,
    destination_domain: entry.destinationDomain,
    http_method: entry.httpMethod,
    request_size_bytes: entry.requestSizeBytes,
    detection_results: entry.detectionResults,
    action: entry.action,
    reason_code: entry.reasonCode,
    latency_ms: entry.latencyMs,
    policy_version: entry.policyVersion,
    gateway_version: entry.gatewayVersion,
  };
}

export function encodeCursor(cursor: AuditCursor): string {
  return Buffer.from(`${cursor.timestamp.toISOString()}|${cursor.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): AuditCursor {
  let raw = "";
  try {
    raw = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed.");
  }
  const separator = raw.indexOf("|");
  if (separator <= 0) throw new AppError(400, "VALIDATION_ERROR", "Validation failed.");
  const timestamp = new Date(raw.slice(0, separator));
  const id = raw.slice(separator + 1);
  if (Number.isNaN(timestamp.getTime()) || !id || id.length > 80) {
    throw new AppError(400, "VALIDATION_ERROR", "Validation failed.");
  }
  return { timestamp, id };
}
