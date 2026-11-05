import type { IdentityKeyRecord } from "../domain.js";
import { assertClaims, buildClaims, type GatewayProofClaims, type IssueGatewayProofInput } from "./credentialService.js";
import { didKeyToPublicKey, signBytes, verifyBytes } from "./didService.js";
import type { KeyStore } from "./keyStore.js";
import type { ReplayStore } from "./replayStore.js";

export class ProofError extends Error {
  readonly reason: "expired" | "invalid" | "replay";

  constructor(reason: "expired" | "invalid" | "replay") {
    super("gateway proof rejected");
    this.name = "ProofError";
    this.reason = reason;
  }
}

export function signProof(key: IdentityKeyRecord, claims: GatewayProofClaims): string {
  const header = { alg: "EdDSA", typ: "gateway-proof+jwt", kid: key.subjectId };
  const signingInput = `${encodeJson(header)}.${encodeJson(claims)}`;
  const signature = signBytes(Buffer.from(key.privateKey, "base64"), Buffer.from(signingInput));
  return `${signingInput}.${signature.toString("base64url")}`;
}

export async function verifyProof(proof: string, keys: KeyStore, replay: ReplayStore, now: Date): Promise<GatewayProofClaims> {
  const parts = proof.split(".");
  if (parts.length !== 3) throw new ProofError("invalid");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new ProofError("invalid");
  let header: { alg?: string; kid?: string };
  let payload: unknown;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as { alg?: string; kid?: string };
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new ProofError("invalid");
  }
  if (header.alg !== "EdDSA" || !header.kid) throw new ProofError("invalid");
  let claims: GatewayProofClaims;
  try {
    claims = assertClaims(payload, now);
  } catch (error) {
    if (error instanceof Error && error.message === "expired claims") throw new ProofError("expired");
    throw new ProofError("invalid");
  }
  const record = await keys.findBySubjectId(header.kid);
  if (!record || record.subjectId !== header.kid) throw new ProofError("invalid");
  let embedded: Buffer;
  try {
    embedded = didKeyToPublicKey(header.kid);
  } catch {
    throw new ProofError("invalid");
  }
  const publicKey = Buffer.from(record.publicKey, "base64");
  if (!publicKey.equals(embedded)) throw new ProofError("invalid");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(encodedSignature, "base64url");
  if (!verifyBytes(publicKey, Buffer.from(signingInput), signature)) throw new ProofError("invalid");
  const consumed = await replay.consume(claims.request_id);
  if (consumed === "replay") throw new ProofError("replay");
  if (consumed !== "ok") throw new ProofError("invalid");
  return claims;
}

export function createClaims(input: IssueGatewayProofInput, now: Date, ttlSeconds: number): GatewayProofClaims {
  return buildClaims(input, now, ttlSeconds);
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
