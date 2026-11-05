import { createHash, randomBytes } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const plaintext = `ask_${randomBytes(32).toString("base64url")}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 12),
  };
}
