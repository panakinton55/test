import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacFingerprint(value: string, salt: string, tenantId: string): string {
  return createHmac("sha256", salt).update(`fp|${tenantId}|${value}`).digest("hex").slice(0, 16);
}

export function hashIp(ip: string, salt: string, tenantId: string): string {
  return createHmac("sha256", salt).update(`ip|${tenantId}|${ip}`).digest("hex");
}

export function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}
