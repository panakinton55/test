import { canonicalize, sha256Hex } from '../lib/encoding.js';

export const AUDIT_GENESIS = '0'.repeat(64);

export type AuditBody = {
  ts: string;
  event: 'dispatch';
  decision: 'allow' | 'deny';
  code: string;
  rule: string | null;
  requestId: string | null;
  did: string | null;
  destination: string | null;
  scope: string | null;
  payloadHash: string;
  contextHash: string | null;
  remoteHash: string;
};

export type AuditEvent = AuditBody & {
  prevHash: string;
  hash: string;
};

export function sealAuditEvent(prevHash: string, body: AuditBody): AuditEvent {
  const hash = sha256Hex(canonicalize({ ...body, prevHash }));
  return { ...body, prevHash, hash };
}

export function verifyAuditChain(events: readonly AuditEvent[], anchor = AUDIT_GENESIS): boolean {
  let previous = anchor;
  for (const event of events) {
    if (event.prevHash !== previous) return false;
    const { hash: _hash, ...rest } = event;
    const recomputed = sealAuditEvent(rest.prevHash, rest);
    if (recomputed.hash !== event.hash) return false;
    previous = event.hash;
  }
  return true;
}

export class AuditLog {
  private events: AuditEvent[] = [];
  private head = AUDIT_GENESIS;
  private anchor = AUDIT_GENESIS;

  constructor(
    private readonly sink: (line: string) => void = (line) => {
      process.stdout.write(`${line}\n`);
    },
    private readonly limit = 500,
  ) {}

  append(body: AuditBody): AuditEvent {
    const event = sealAuditEvent(this.head, body);
    this.events.push(event);
    this.head = event.hash;
    if (this.events.length > this.limit) {
      const dropped = this.events.shift();
      if (dropped) this.anchor = dropped.hash;
    }
    this.sink(JSON.stringify(event));
    return event;
  }

  list(): AuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  verify(): boolean {
    return verifyAuditChain(this.events, this.anchor) && (this.events.at(-1)?.hash ?? this.anchor) === this.head;
  }

  get length(): number {
    return this.events.length;
  }

  get tip(): string {
    return this.head;
  }
}
