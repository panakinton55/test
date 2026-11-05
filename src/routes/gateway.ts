import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { BLOCKED_MESSAGE, PLAN_LIMITS, type AuditLogRecord, type Modification } from "../domain.js";
import type { AppDependencies, AppEnv } from "../deps.js";
import { recordAudit } from "../core/auditLogger.js";
import { evaluateRequest, sanitizeUpstreamBody } from "../core/policyEngine.js";
import { clientIp, requireApiKey } from "../middleware/auth.js";
import { proxyRequestSchema } from "../openapi/schemas.js";
import { AppError, parseBody } from "../utils/errors.js";
import { hashIp } from "../utils/hash.js";
import { createId } from "../utils/ids.js";

export function registerGatewayRoutes(app: Hono<AppEnv>, deps: AppDependencies): void {
  app.post("/v1/gateway/proxy", async (c) => {
    const started = deps.now().getTime();
    const requestId = c.get("requestId");
    const auth = await requireApiKey(c, deps.store);
    const plan = PLAN_LIMITS[auth.tenant.plan];
    const sourceIpHash = hashIp(clientIp(c), deps.config.ipHashSalt, auth.tenant.id);
    const contentLength = Number(c.req.header("content-length") ?? "0");

    const base = (): AuditLogRecord => ({
      id: createId("aud"),
      requestId,
      tenantId: auth.tenant.id,
      agentId: "unknown",
      policyId: null,
      timestamp: deps.now(),
      sourceIpHash,
      destinationDomain: "",
      httpMethod: "POST",
      requestSizeBytes: Number.isFinite(contentLength) ? contentLength : 0,
      detectionResults: [],
      action: "block",
      reasonCode: null,
      latencyMs: 0,
      policyVersion: null,
      gatewayVersion: deps.config.gatewayVersion,
    });

    const respond = async (status: ContentfulStatusCode, payload: Record<string, unknown>, entry: AuditLogRecord, extraHeaders?: Record<string, string>) => {
      entry.latencyMs = Math.max(0, deps.now().getTime() - started);
      if ("latency_ms" in payload) payload.latency_ms = entry.latencyMs;
      await recordAudit(deps.store, entry, deps.logger, deps.alertSink);
      if (extraHeaders) {
        for (const [key, value] of Object.entries(extraHeaders)) c.header(key, value);
      }
      return c.json(payload, status);
    };

    // 1. API key authentication is complete.
    // 2. Tenant ceiling, then the agent policy limit once the body identifies the agent.
    const tenantRate = await deps.rateLimiter.consume(`tenant:${auth.tenant.id}`, plan.rateLimit, plan.rateWindowSeconds);
    if (!tenantRate.allowed) {
      const entry = base();
      entry.reasonCode = "RATE_LIMIT_EXCEEDED";
      return respond(429, blocked(requestId, "RATE_LIMIT_EXCEEDED", []), entry, { "retry-after": String(tenantRate.retryAfterSeconds) });
    }

    // 3. Request size, first from the declared length and again from the bytes read.
    if (Number.isFinite(contentLength) && contentLength > plan.maxRequestBytes) {
      const entry = base();
      entry.reasonCode = "REQUEST_TOO_LARGE";
      return respond(413, blocked(requestId, "REQUEST_TOO_LARGE", [{ category: "request_size", action: "block" }]), entry);
    }

    const raw = await c.req.text();
    const bytes = Buffer.byteLength(raw);
    if (bytes > plan.maxRequestBytes) {
      const entry = base();
      entry.requestSizeBytes = bytes;
      entry.reasonCode = "REQUEST_TOO_LARGE";
      return respond(413, blocked(requestId, "REQUEST_TOO_LARGE", [{ category: "request_size", action: "block" }]), entry);
    }

    let parsed: unknown;
    try {
      parsed = raw ? (JSON.parse(raw) as unknown) : {};
    } catch {
      const entry = base();
      entry.requestSizeBytes = bytes;
      entry.reasonCode = "VALIDATION_ERROR";
      return respond(400, { request_id: requestId, error: { code: "VALIDATION_ERROR", message: "Validation failed." } }, entry);
    }

    let body: ReturnType<typeof proxyRequestSchema.parse>;
    try {
      body = parseBody(proxyRequestSchema, parsed);
    } catch (error) {
      if (error instanceof AppError) {
        const entry = base();
        entry.requestSizeBytes = bytes;
        entry.reasonCode = error.code;
        return respond(error.status as ContentfulStatusCode, { request_id: requestId, error: { code: error.code, message: error.message } }, entry);
      }
      throw error;
    }

    // 4. Policy for this tenant and agent. A tenant-wide policy is the fallback.
    const policy = await deps.store.findEffectivePolicy(auth.tenant.id, body.agent_id);
    const entry = base();
    entry.agentId = body.agent_id;
    entry.httpMethod = body.method;
    entry.requestSizeBytes = bytes;
    entry.destinationDomain = hostnameOf(body.destination);

    if (!policy) {
      entry.reasonCode = "POLICY_NOT_FOUND";
      return respond(403, blocked(requestId, "POLICY_NOT_FOUND", []), entry);
    }
    entry.policyId = policy.id;
    entry.policyVersion = policy.version;

    if (bytes > policy.maxRequestBytes) {
      entry.reasonCode = "REQUEST_TOO_LARGE";
      return respond(413, blocked(requestId, "REQUEST_TOO_LARGE", [{ category: "request_size", action: "block" }]), entry);
    }

    const policyRate = await deps.rateLimiter.consume(
      `policy:${auth.tenant.id}:${body.agent_id}`,
      Math.min(plan.rateLimit, policy.rateLimit),
      policy.rateWindowSeconds,
    );
    if (!policyRate.allowed) {
      entry.reasonCode = "RATE_LIMIT_EXCEEDED";
      return respond(429, blocked(requestId, "RATE_LIMIT_EXCEEDED", []), entry, { "retry-after": String(policyRate.retryAfterSeconds) });
    }

    // 5-7. Destination allow list, sensitive-data detection, and mask / block decision.
    const decision = evaluateRequest({
      policy,
      destination: body.destination,
      headers: body.headers ?? {},
      body: body.body,
      salt: deps.config.ipHashSalt,
      tenantId: auth.tenant.id,
      allowInsecureUpstream: deps.config.allowInsecureUpstream,
    });
    entry.destinationDomain = decision.domain || entry.destinationDomain;
    entry.detectionResults = decision.safeDetections;
    entry.action = decision.auditAction;
    entry.reasonCode = decision.reasonCode ?? null;

    if (decision.blocked) {
      return respond(403, blocked(requestId, decision.reasonCode ?? "SENSITIVE_DATA_DETECTED", decision.details), entry);
    }

    // 8. Internal proof. The compact token is attached upstream and is not returned to the caller.
    await deps.store.ensureAgent(auth.tenant.id, body.agent_id);
    let proof = "";
    try {
      proof = await deps.identity.issueGatewayProof({
        tenantId: auth.tenant.id,
        agentId: body.agent_id,
        policyId: policy.id,
        requestId,
        allowedScope: policy.allowedDomains,
      });
    } catch (error) {
      deps.logger.error({ name: error instanceof Error ? error.name : "error", requestId }, "proof issuance failed");
      entry.action = "block";
      entry.reasonCode = "INTERNAL_ERROR";
      return respond(500, { request_id: requestId, error: { code: "INTERNAL_ERROR", message: "The request could not be processed." } }, entry);
    }

    // 9. Forward the sanitized request.
    let upstream: { status: number; bodyText: string };
    try {
      upstream = await deps.proxyClient.forward({
        url: decision.sanitized.destination,
        method: body.method,
        headers: decision.sanitized.headers,
        body: decision.sanitized.body ?? undefined,
        proof,
      });
    } catch {
      entry.action = "block";
      entry.reasonCode = "UPSTREAM_ERROR";
      return respond(502, { request_id: requestId, error: { code: "UPSTREAM_ERROR", message: "The upstream request could not be completed." } }, entry);
    }

    // 10. Inspect and mask the upstream response before it reaches the agent.
    const scanned = sanitizeUpstreamBody(upstream.bodyText, policy, deps.config.ipHashSalt, auth.tenant.id, [proof, auth.presentedKey]);
    entry.detectionResults = [...decision.safeDetections, ...scanned.safeDetections];
    entry.action = decision.auditAction === "mask" || scanned.auditAction === "mask" ? "mask" : "allow";
    entry.reasonCode = null;

    // 11-12. Audit, then return the minimized result.
    return respond(200, {
      request_id: requestId,
      status: "allowed",
      destination: decision.sanitized.destination,
      latency_ms: 0,
      modifications: mergeModifications(decision.modifications, scanned.modifications),
      upstream: { status: upstream.status, body: scanned.body },
    }, entry);
  });
}

function blocked(requestId: string, reasonCode: string, details: { category: string; action: string }[]): Record<string, unknown> {
  return {
    request_id: requestId,
    status: "blocked",
    reason_code: reasonCode,
    details,
    message: BLOCKED_MESSAGE,
  };
}

function mergeModifications(left: Modification[], right: Modification[]): Modification[] {
  const map = new Map<string, Modification>();
  for (const item of [...left, ...right]) {
    const key = `${item.type}:${item.category}`;
    const current = map.get(key) ?? { type: item.type, category: item.category, count: 0 };
    current.count += item.count;
    map.set(key, current);
  }
  return [...map.values()];
}

function hostnameOf(value: string): string {
  try {
    return new URL(value).hostname.slice(0, 253);
  } catch {
    return "";
  }
}
