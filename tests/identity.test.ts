import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../src/db/memoryStore.js";
import { didKeyToPublicKey, generateEd25519, publicKeyToDidKey, signBytes, verifyBytes } from "../src/identity/didService.js";
import { createInternalIdentity } from "../src/identity/index.js";
import { createMemoryReplayStore } from "../src/identity/replayStore.js";

const input = {
  tenantId: "ten_test",
  agentId: "sales-bot",
  policyId: "pol_test",
  requestId: "req_test",
  allowedScope: ["api.example.com"],
};

describe("internal proof", () => {
  it("round-trips a local key identifier and signature", () => {
    const pair = generateEd25519();
    const subject = publicKeyToDidKey(pair.publicKey);
    expect(subject.startsWith("did:key:z")).toBe(true);
    expect(didKeyToPublicKey(subject).equals(pair.publicKey)).toBe(true);
    const data = Buffer.from("gateway");
    expect(verifyBytes(pair.publicKey, data, signBytes(pair.privateKey, data))).toBe(true);
  });

  it("issues a five-minute proof and rejects tampering, expiry, and replay", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const store = createMemoryStore();
    const replay = createMemoryReplayStore(() => now);
    const identity = createInternalIdentity({ store, replay, ttlSeconds: 300, now: () => now });
    const proof = await identity.issueGatewayProof(input);
    const claims = await identity.verifyGatewayProof(proof);
    expect(claims).toMatchObject({
      tenant_id: input.tenantId,
      agent_id: input.agentId,
      policy_id: input.policyId,
      request_id: input.requestId,
      allowed_scope: input.allowedScope,
    });
    expect(new Date(claims.expires_at).getTime() - new Date(claims.issued_at).getTime()).toBe(300_000);
    await expect(identity.verifyGatewayProof(proof)).rejects.toMatchObject({ reason: "replay" });

    const second = createInternalIdentity({
      store,
      replay: createMemoryReplayStore(() => now),
      ttlSeconds: 300,
      now: () => now,
    });
    const fresh = await second.issueGatewayProof({ ...input, requestId: "req_fresh" });
    const parts = fresh.split(".");
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as { agent_id: string };
    payload.agent_id = "other-bot";
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
    await expect(second.verifyGatewayProof(parts.join("."))).rejects.toMatchObject({ reason: "invalid" });

    const expiring = await second.issueGatewayProof({ ...input, requestId: "req_expire" });
    now = new Date(now.getTime() + 301_000);
    await expect(second.verifyGatewayProof(expiring)).rejects.toMatchObject({ reason: "expired" });
    expect(() => createInternalIdentity({ store, replay, ttlSeconds: 301 })).toThrow(/300/);
  });

  it("keeps internal subject details out of the customer-facing surface", () => {
    const readme = readFileSync("README.md", "utf8");
    const customer = readme.split("## Internal Architecture")[0] ?? "";
    expect(customer.length).toBeGreaterThan(100);
    expect(customer).not.toMatch(/DID|did:key|Verifiable Credential|分散型/);
    expect(customer).not.toMatch(/100\s*%/);
    for (const file of walk("src/routes").concat(walk("src/openapi"))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/did:key|didService|Verifiable Credential/);
    }
  });
});

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
