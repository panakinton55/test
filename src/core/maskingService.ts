import type { Finding, PolicyAction } from "../domain.js";

const TOKEN_LABELS: Record<string, string> = {
  email: "EMAIL",
  phone_number: "PHONE_NUMBER",
  credit_card: "CREDIT_CARD",
  jwt: "JWT",
  bearer_token: "BEARER_TOKEN",
  aws_access_key: "AWS_ACCESS_KEY",
  private_key: "PRIVATE_KEY",
  address: "ADDRESS",
  my_number: "MY_NUMBER",
  custom: "CUSTOM",
};

export function redactionToken(category: string, urlSafe = false): string {
  const normalized = category.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const label = TOKEN_LABELS[category] ?? (normalized || "SENSITIVE");
  return urlSafe ? `REDACTED_${label}` : `[REDACTED:${label}]`;
}

export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return redactionToken("email");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!domain || local.length === 0) return redactionToken("email");
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return redactionToken("phone_number");
  return `${digits.slice(0, 3)}-****-**${digits.slice(-2)}`;
}

export function maskValue(category: string, value: string, action: "mask" | "redact", urlSafe = false): string {
  if (action === "redact") return redactionToken(category, urlSafe);
  if (category === "email") return maskEmail(value);
  if (category === "phone_number") return maskPhone(value);
  if (category === "address") return redactionToken("address", urlSafe);
  return redactionToken(category, urlSafe);
}

export type Replacement = Finding & { action: PolicyAction };

export function applyReplacements(text: string, findings: Replacement[], urlSafe = false): string {
  const ordered = [...findings].sort((left, right) => right.start - left.start);
  let output = text;
  for (const finding of ordered) {
    if (finding.action === "allow" || finding.action === "block") continue;
    const replacement = maskValue(finding.category, finding.value, finding.action === "redact" ? "redact" : "mask", urlSafe);
    output = output.slice(0, finding.start) + replacement + output.slice(finding.end);
  }
  return output;
}
