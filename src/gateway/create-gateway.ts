import { createHash, randomBytes } from 'node:crypto';
import { AuditLog, type AuditBody } from '../audit/log.js';
import type { DispatchBody } from '../guard/schema.js';
import { DESTINATIONS, type Destination } from '../guard/schema.js';
import { provisionAgent, publicRecord, type AgentIdentity } from '../identity/provision.js';
import { sha256Hex } from '../lib/encoding.js';
import { authenticateRequest, readableDid } from '../middleware/authenticate.js';
import { authorizeRequest } from '../middleware/authorize.js';
import { guardPayload } from '../middleware/guard.js';
import { NonceStore, RateLimiter } from '../middleware/nonce-store.js';
import { AgentRegistry } from '../registry/registry.js';
import { forwardDispatch } from '../forward/forward.js';
import { runDemoScenario } from '../http/demo.js';

export type GatewayOptions = {
  demo?: boolean;
  now?: () => number;
  auditSink?: (line: string) => void;
  auditLimit?: number;
  contextKey?: Buffer;
  clockSkewSec?: number;
  nonceTtlMs?: number;
  ratePerMin?: number;
  rateBurst?: number;
  maxBodyBytes?: number;
  upstreams?: Partial<Record<Destination, string>>;
  fetchImpl?: typeof fetch;
};

type ClientBody = Record<string, unknown>;

export type HttpResult = {
  status: number;
  body: ClientBody;
};

const RESULT = {
  forwarded: { status: 200, decision: 'allow', message: '検証済みリクエストを転送しました' },
  too_large: { status: 413, decision: 'deny', message: 'リクエストが上限を超えています' },
  rate_limited: { status: 429, decision: 'deny', message: 'リクエスト頻度が上限を超えています' },
  header_missing: { status: 401, decision: 'deny', message: '認証ヘッダーが不足しています' },
  timestamp_invalid: { status: 401, decision: 'deny', message: 'タイムスタンプが許容範囲外です' },
  did_malformed: { status: 401, decision: 'deny', message: 'DIDの形式が不正です' },
  did_unknown: { status: 401, decision: 'deny', message: 'DIDが登録されていません' },
  signature_invalid: { status: 401, decision: 'deny', message: 'DID署名を検証できません' },
  nonce_invalid: { status: 401, decision: 'deny', message: 'ノンスの形式が不正です' },
  replay: { status: 409, decision: 'deny', message: '同じノンスが再利用されました' },
  payload_invalid: { status: 400, decision: 'deny', message: 'ペイロードがスキーマに一致しません' },
  guardrail_blocked: { status: 403, decision: 'deny', message: 'ガードレールがリクエストを拒否しました' },
  zkp_invalid: { status: 401, decision: 'deny', message: '検証トークンを確認できません' },
  scope_denied: { status: 403, decision: 'deny', message: '要求されたスコープが許可されていません' },
  upstream_error: { status: 502, decision: 'deny', message: '宛先への転送に失敗しました' },
  not_found: { status: 404, decision: 'deny', message: '対象が見つかりません' },
  internal: { status: 500, decision: 'deny', message: 'ゲートウェイ内部で失敗しました' },
} as const;

type ResultCode = keyof typeof RESULT;

function contextKeyFromEnv(override?: Buffer): Buffer {
  if (override) {
    if (override.length !== 32) throw new Error('context_key');
    return override;
  }
  const configured = process.env.GATEWAY_CONTEXT_KEY;
  if (!configured) return randomBytes(32);
  return createHash('sha256').update(configured, 'utf8').digest();
}

export class Gateway {
  readonly audit: AuditLog;
  readonly registry = new AgentRegistry();
  readonly demoEnabled: boolean;
  private readonly full: AgentIdentity | null;
  private readonly limited: AgentIdentity | null;
  private readonly nonces = new NonceStore();
  private readonly rates: RateLimiter;
  private readonly now: () => number;
  private readonly clockSkewSec: number;
  private readonly nonceTtlMs: number;
  readonly maxBodyBytes: number;
  private readonly contextKey: Buffer;
  private readonly upstreams: Partial<Record<Destination, string>>;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly remoteSalt = randomBytes(16).toString('hex');

  private constructor(options: GatewayOptions, full: AgentIdentity | null, limited: AgentIdentity | null) {
    this.full = full;
    this.limited = limited;
    this.demoEnabled = full !== null && limited !== null;
    this.audit = new AuditLog(options.auditSink, options.auditLimit ?? 500);
    this.now = options.now ?? (() => Date.now());
    this.clockSkewSec = options.clockSkewSec ?? 60;
    this.nonceTtlMs = options.nonceTtlMs ?? 5 * 60 * 1000;
    this.maxBodyBytes = options.maxBodyBytes ?? 32 * 1024;
    this.rates = new RateLimiter(options.ratePerMin ?? 60, options.rateBurst ?? 30);
    this.contextKey = contextKeyFromEnv(options.contextKey);
    this.upstreams = options.upstreams ?? {};
    this.fetchImpl = options.fetchImpl;
    if (full) this.registry.add(publicRecord(full));
    if (limited) this.registry.add(publicRecord(limited));
  }

  static async create(options: GatewayOptions = {}): Promise<Gateway> {
    const demo = options.demo ?? process.env.GATEWAY_DEMO !== '0';
    if (!demo) return new Gateway(options, null, null);
    const full = await provisionAgent(['llm.invoke', 'search.read', 'tools.invoke']);
    const limited = await provisionAgent(['search.read']);
    return new Gateway(options, full, limited);
  }

  health(): ClientBody {
    return {
      ok: true,
      service: 'agent-secure-gateway',
      demo: this.demoEnabled,
      demoAgent: this.full ? { did: this.full.did, scopes: this.full.scopes } : null,
      destinations: DESTINATIONS,
      audit: {
        length: this.audit.length,
        chainValid: this.audit.verify(),
        tip: this.audit.tip,
      },
    };
  }

  async dispatch(input: {
    headers: Record<string, string | undefined>;
    rawBody: string;
    remoteIp: string;
  }): Promise<HttpResult> {
    const nowMs = this.now();
    const payloadHash = sha256Hex(input.rawBody);
    const remoteHash = sha256Hex(`${this.remoteSalt}:${input.remoteIp}`).slice(0, 24);
    const presentedDid = readableDid(input.headers['x-did']);

    const deny = (
      code: ResultCode,
      details: {
        did?: string | null;
        requestId?: string | null;
        destination?: string | null;
        scope?: string | null;
        rule?: string | null;
        contextHash?: string | null;
        extra?: ClientBody;
      } = {},
    ): HttpResult => {
      const spec = RESULT[code];
      const body: AuditBody = {
        ts: new Date(nowMs).toISOString(),
        event: 'dispatch',
        decision: spec.decision,
        code,
        rule: details.rule ?? null,
        requestId: details.requestId ?? null,
        did: details.did === undefined ? presentedDid : details.did,
        destination: details.destination ?? null,
        scope: details.scope ?? null,
        payloadHash,
        contextHash: details.contextHash ?? null,
        remoteHash,
      };
      this.audit.append(body);
      return {
        status: spec.status,
        body: {
          ok: spec.decision === 'allow',
          code,
          message: spec.message,
          ...(details.requestId ? { requestId: details.requestId } : {}),
          ...(details.destination ? { destination: details.destination } : {}),
          ...(details.rule && code === 'guardrail_blocked' ? { rule: details.rule } : {}),
          ...(details.extra ?? {}),
        },
      };
    };

    try {
      if (Buffer.byteLength(input.rawBody) > this.maxBodyBytes) {
        return deny('too_large');
      }
      if (!this.rates.allow(remoteHash, nowMs)) {
        return deny('rate_limited');
      }

      const auth = await authenticateRequest({
        headers: input.headers,
        rawBody: input.rawBody,
        nowMs,
        clockSkewSec: this.clockSkewSec,
        nonceTtlMs: this.nonceTtlMs,
        registry: this.registry,
        nonces: this.nonces,
      });
      if (!auth.ok) return deny(auth.code, { did: auth.did });

      const guarded = guardPayload(input.rawBody);
      if (!guarded.ok) {
        return deny(guarded.code, {
          did: auth.value.did,
          rule: guarded.code === 'guardrail_blocked' ? guarded.rule : null,
          extra: guarded.code === 'payload_invalid' ? { issues: guarded.issues } : {},
        });
      }

      const authorized = authorizeRequest({
        tokenHeader: auth.value.tokenHeader,
        agent: auth.value.agent,
        did: auth.value.did,
        nonce: auth.value.nonce,
        timestamp: auth.value.timestamp,
        canonicalHash: auth.value.canonicalHash,
        destination: guarded.body.destination,
      });
      if (!authorized.ok) {
        return deny(authorized.code, {
          did: auth.value.did,
          requestId: guarded.body.requestId,
          destination: guarded.body.destination,
          rule: authorized.rule,
        });
      }

      const forwarded = await forwardDispatch({
        body: guarded.body,
        claims: {
          did: auth.value.did,
          scope: authorized.scope,
          requestId: guarded.body.requestId,
          destination: guarded.body.destination,
          iat: auth.value.timestamp,
        },
        key: this.contextKey,
        upstreams: this.upstreams,
        ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
      });
      if (!forwarded.ok) {
        return deny('upstream_error', {
          did: auth.value.did,
          requestId: guarded.body.requestId,
          destination: guarded.body.destination,
          scope: authorized.scope,
        });
      }

      return deny('forwarded', {
        did: auth.value.did,
        requestId: guarded.body.requestId,
        destination: guarded.body.destination,
        scope: authorized.scope,
        contextHash: sha256Hex(forwarded.contextHashInput),
        extra: { upstream: forwarded.upstream },
      });
    } catch {
      return deny('internal');
    }
  }

  async demo(body: unknown, remoteIp: string): Promise<HttpResult> {
    if (!this.full || !this.limited) {
      return { status: 404, body: { ok: false, code: 'not_found', message: RESULT.not_found.message } };
    }
    return runDemoScenario(
      {
        dispatch: (request) => this.dispatch(request),
        full: this.full,
        limited: this.limited,
      },
      body,
      remoteIp,
    );
  }
}

export async function createGateway(options: GatewayOptions = {}): Promise<Gateway> {
  return Gateway.create(options);
}

export function sampleDispatchBody(overrides: Partial<DispatchBody> = {}): DispatchBody {
  return {
    requestId: overrides.requestId ?? '00000000-0000-4000-8000-000000000001',
    destination: overrides.destination ?? 'llm.completions',
    prompt: overrides.prompt ?? '次の文を要約してください。検証済みの内容だけを転送します。',
    parameters: overrides.parameters ?? { format: 'text' },
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}
