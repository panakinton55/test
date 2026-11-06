import { base64url } from 'jose';
import { safeEqualHex } from '../lib/encoding.js';
import { SCOPE_FOR, type Destination } from '../guard/schema.js';
import type { RegisteredAgent } from '../registry/registry.js';
import { verifyZkpToken, zkpTokenSchema } from '../zkp/token.js';

export type Authorization =
  | { ok: true; scope: string }
  | { ok: false; code: 'zkp_invalid' | 'scope_denied'; rule: string };

export function authorizeRequest(input: {
  tokenHeader: string;
  agent: RegisteredAgent;
  did: string;
  nonce: string;
  timestamp: number;
  canonicalHash: string;
  destination: Destination;
}): Authorization {
  const requiredScope = SCOPE_FOR[input.destination];
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder().decode(base64url.decode(input.tokenHeader)));
  } catch {
    return { ok: false, code: 'zkp_invalid', rule: 'zkp.malformed' };
  }
  const parsed = zkpTokenSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, code: 'zkp_invalid', rule: 'zkp.malformed' };
  const token = parsed.data;
  const bound =
    token.did === input.did &&
    token.nonce === input.nonce &&
    token.iat === input.timestamp &&
    token.req === input.canonicalHash &&
    token.scope === requiredScope;
  if (!bound) return { ok: false, code: 'zkp_invalid', rule: 'zkp.binding' };
  if (!input.agent.scopes.includes(requiredScope)) {
    return { ok: false, code: 'scope_denied', rule: 'policy.scope' };
  }
  if (!safeEqualHex(token.attrCommitment, input.agent.attrCommitment)) {
    return { ok: false, code: 'zkp_invalid', rule: 'zkp.commitment' };
  }
  if (!verifyZkpToken(token, input.agent.zkpPublic)) {
    return { ok: false, code: 'zkp_invalid', rule: 'zkp.proof' };
  }
  return { ok: true, scope: requiredScope };
}
