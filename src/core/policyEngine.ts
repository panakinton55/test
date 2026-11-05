import type {
  CustomDetectorRule,
  Finding,
  Modification,
  PolicyAction,
  PolicyRecord,
  SafeDetection,
} from "../domain.js";
import { DEFAULT_ACTIONS } from "../domain.js";
import { domainAllowed, isUnsafeHostname } from "./destinationGuard.js";
import { applyReplacements, type Replacement } from "./maskingService.js";
import { detectSensitiveData } from "./sensitiveDataDetector.js";
import { hmacFingerprint } from "../utils/hash.js";

const MAX_DEPTH = 32;

export type Evaluation = {
  blocked: boolean;
  reasonCode?: string;
  details: { category: string; action: string }[];
  auditAction: "allow" | "mask" | "block";
  modifications: Modification[];
  safeDetections: SafeDetection[];
  sanitized: {
    destination: string;
    headers: Record<string, string>;
    body: unknown;
  };
  domain: string;
};

type ScanState = {
  blocked: boolean;
  reasonOverride?: string;
  detections: SafeDetection[];
  modifications: Map<string, Modification>;
  details: Map<string, { category: string; action: string }>;
};

type ScanContext = {
  policy: PolicyRecord;
  salt: string;
  tenantId: string;
  mode: "request" | "response";
  rules: CustomDetectorRule[];
};

export function evaluateRequest(input: {
  policy: PolicyRecord;
  destination: string;
  headers: Record<string, string>;
  body: unknown;
  salt: string;
  tenantId: string;
  allowInsecureUpstream: boolean;
}): Evaluation {
  const state = emptyState();
  const rules = customRulesFromPolicy(input.policy);
  const ctx: ScanContext = { policy: input.policy, salt: input.salt, tenantId: input.tenantId, mode: "request", rules };
  const destination = inspectDestination(input.destination, input.allowInsecureUpstream, input.policy, state, ctx);
  if (!destination.ok) {
    return finish(state, destination.reason, { destination: "", headers: {}, body: null }, destination.domain, true);
  }
  const headers = sanitizeHeaders(input.headers, state, ctx);
  const body = sanitizeValue(input.body, "body", 0, state, ctx);
  if (state.blocked || state.reasonOverride) {
    return finish(state, state.reasonOverride ?? "SENSITIVE_DATA_DETECTED", { destination: "", headers: {}, body: null }, destination.domain, true);
  }
  return finish(state, undefined, { destination: destination.sanitized, headers, body }, destination.domain, false);
}

export function sanitizeUpstreamBody(bodyText: string, policy: PolicyRecord, salt: string, tenantId: string, secrets: string[] = []): {
  body: unknown;
  modifications: Modification[];
  safeDetections: SafeDetection[];
  auditAction: "allow" | "mask";
} {
  let text = bodyText;
  for (const secret of secrets) {
    if (secret.length < 12) continue;
    text = text.split(secret).join("[REDACTED:CONTEXT]");
  }
  if (text.length > 1_000_000) {
    return {
      body: "[REDACTED:UPSTREAM_BODY_TOO_LARGE]",
      modifications: [{ type: "redact", category: "upstream_body", count: 1 }],
      safeDetections: [],
      auditAction: "mask",
    };
  }
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = text;
  }
  const state = emptyState();
  const ctx: ScanContext = {
    policy,
    salt,
    tenantId,
    mode: "response",
    rules: customRulesFromPolicy(policy),
  };
  const body = sanitizeValue(parsed, "response", 0, state, ctx);
  return {
    body,
    modifications: [...state.modifications.values()],
    safeDetections: state.detections,
    auditAction: state.modifications.size > 0 ? "mask" : "allow",
  };
}

export function customRulesFromPolicy(policy: PolicyRecord): CustomDetectorRule[] {
  const rules: CustomDetectorRule[] = [];
  policy.blockedPatterns.forEach((keyword, index) => {
    rules.push({ ruleId: `blocked:${index}`, keyword });
  });
  policy.maskingRules.forEach((rule, index) => {
    if (rule.category !== "custom") return;
    const custom: CustomDetectorRule = { ruleId: `rule:${index}` };
    if (rule.keyword) custom.keyword = rule.keyword;
    if (rule.pattern) custom.pattern = rule.pattern;
    rules.push(custom);
  });
  return rules;
}

function inspectDestination(
  destination: string,
  allowInsecureUpstream: boolean,
  policy: PolicyRecord,
  state: ScanState,
  ctx: ScanContext,
): { ok: boolean; reason: string; domain: string; sanitized: string } {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return { ok: false, reason: "DESTINATION_BLOCKED", domain: "", sanitized: "" };
  }
  const domain = url.hostname;
  if (url.username || url.password || isUnsafeHostname(domain)) {
    return { ok: false, reason: "DESTINATION_BLOCKED", domain, sanitized: "" };
  }
  const schemeAllowed = url.protocol === "https:" || (allowInsecureUpstream && url.protocol === "http:");
  if (!schemeAllowed) return { ok: false, reason: "DESTINATION_BLOCKED", domain, sanitized: "" };
  if (!domainAllowed(domain, policy.allowedDomains)) {
    return { ok: false, reason: "DOMAIN_NOT_ALLOWED", domain, sanitized: "" };
  }
  const sanitized = sanitizeString(destination, "url", state, ctx);
  if (state.blocked) return { ok: false, reason: "SENSITIVE_DATA_DETECTED", domain, sanitized: "" };
  if (sanitized !== destination) {
    try {
      const rewritten = new URL(sanitized);
      if (rewritten.hostname !== url.hostname || rewritten.protocol !== url.protocol) {
        return { ok: false, reason: "DESTINATION_BLOCKED", domain, sanitized: "" };
      }
    } catch {
      return { ok: false, reason: "DESTINATION_BLOCKED", domain, sanitized: "" };
    }
  }
  return { ok: true, reason: "", domain, sanitized };
}

function sanitizeHeaders(headers: Record<string, string>, state: ScanState, ctx: ScanContext): Record<string, string> {
  const hop = new Set([
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
    "te",
    "trailer",
    "proxy-authorization",
    "proxy-connection",
  ]);
  const output: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (hop.has(lower) || lower === "x-api-key" || lower === "x-admin-key" || lower === "x-agentsecure-context") continue;
    // The upstream credential is forwarded and never logged. Tokens inside the prompt are still blocked.
    if (lower === "authorization") {
      output[name] = value;
      continue;
    }
    output[name] = sanitizeString(value, `headers.${lower}`, state, ctx);
  }
  return output;
}

function sanitizeValue(value: unknown, field: string, depth: number, state: ScanState, ctx: ScanContext): unknown {
  if (depth > MAX_DEPTH) {
    state.blocked = true;
    state.reasonOverride = "PAYLOAD_REJECTED";
    return null;
  }
  if (typeof value === "string") return sanitizeString(value, field, state, ctx);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const asText = Number.isInteger(value) ? String(value) : "";
    if (!asText) return value;
    const next = sanitizeString(asText, field, state, ctx);
    return next === asText ? value : next;
  }
  if (typeof value === "boolean" || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${field}[${index}]`, depth + 1, state, ctx));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    let index = 0;
    for (const [key, child] of Object.entries(value)) {
      const sanitizedKey = sanitizeString(key, `${field}.key`, state, ctx);
      const outputKey = sanitizedKey === key ? key : `redacted_${index}`;
      output[outputKey] = sanitizeValue(child, `${field}.${outputKey}`, depth + 1, state, ctx);
      index += 1;
    }
    return output;
  }
  return null;
}

function sanitizeString(text: string, field: string, state: ScanState, ctx: ScanContext): string {
  const normalized = text.normalize("NFKC");
  const findings = detectSensitiveData(normalized, ctx.rules).map((finding) => ({
    ...finding,
    action: resolveAction(finding, ctx.policy),
  }));
  if (findings.length === 0) return text;
  const effective = findings.map((finding) => ({
    ...finding,
    action: (ctx.mode === "response" && finding.action === "block" ? "redact" : finding.action) as PolicyAction,
  }));
  for (const finding of effective) note(state, finding, finding.action, field, ctx);
  const replacements: Replacement[] = effective;
  if (replacements.every((finding) => finding.action === "allow" || finding.action === "block")) return text;
  return applyReplacements(normalized, replacements, field === "url");
}

function resolveAction(finding: Finding, policy: PolicyRecord): PolicyAction {
  if (finding.ruleId?.startsWith("blocked:")) return "block";
  if (finding.ruleId?.startsWith("rule:")) {
    const index = Number(finding.ruleId.slice(5));
    const rule = policy.maskingRules[index];
    if (rule) return rule.action;
  }
  const override = [...policy.maskingRules].reverse().find((rule) => rule.category === finding.category && rule.category !== "custom");
  return override?.action ?? DEFAULT_ACTIONS[finding.category];
}

function note(state: ScanState, finding: Finding, action: PolicyAction, field: string, ctx: ScanContext): void {
  state.details.set(`${finding.category}:${action}`, { category: finding.category, action });
  state.detections.push({
    category: finding.category,
    action,
    field,
    offset: finding.start,
    length: finding.end - finding.start,
    fingerprint: hmacFingerprint(finding.value, ctx.salt, ctx.tenantId),
  });
  if (action === "block") state.blocked = true;
  if (action === "mask" || action === "redact") {
    const key = `${action}:${finding.category}`;
    const current = state.modifications.get(key) ?? { type: action, category: finding.category, count: 0 };
    current.count += 1;
    state.modifications.set(key, current);
  }
}

function finish(
  state: ScanState,
  reasonCode: string | undefined,
  sanitized: Evaluation["sanitized"],
  domain: string,
  blocked: boolean,
): Evaluation {
  const modifications = [...state.modifications.values()];
  let auditAction: Evaluation["auditAction"] = "allow";
  if (blocked) auditAction = "block";
  else if (modifications.length > 0) auditAction = "mask";
  return {
    blocked,
    ...(reasonCode ? { reasonCode } : {}),
    details: [...state.details.values()],
    auditAction,
    modifications,
    safeDetections: state.detections,
    sanitized,
    domain,
  };
}

function emptyState(): ScanState {
  return {
    blocked: false,
    detections: [],
    modifications: new Map(),
    details: new Map(),
  };
}
