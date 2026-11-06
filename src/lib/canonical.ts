import { sha256Hex } from './encoding.js';

export const DISPATCH_PATH = '/api/gateway/dispatch';
export const CANONICAL_VERSION = 'ASG1';

export function hashBody(rawBody: string): string {
  return sha256Hex(rawBody);
}

export function canonicalRequest(input: { timestamp: string; nonce: string; bodyHash: string }): string {
  return [CANONICAL_VERSION, 'POST', DISPATCH_PATH, input.timestamp, input.nonce, input.bodyHash].join('\n');
}
