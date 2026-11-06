import type { Destination, DispatchBody } from '../guard/schema.js';
import { openContext, sealContext, type ContextClaims } from './context.js';

export type ForwardRequest = {
  body: DispatchBody;
  claims: ContextClaims;
  key: Buffer;
  upstreams: Partial<Record<Destination, string>>;
  fetchImpl?: typeof fetch;
};

export type ForwardResult =
  | { ok: true; contextHashInput: string; upstream: Record<string, unknown> }
  | { ok: false; code: 'upstream_error' };

function mockUpstream(body: DispatchBody, claims: ContextClaims, sealed: string, key: Buffer) {
  const opened = openContext(sealed, key, body.destination);
  return {
    mode: 'mock',
    contextVerified:
      opened.did === claims.did &&
      opened.scope === claims.scope &&
      opened.requestId === claims.requestId &&
      opened.destination === body.destination,
    output:
      body.destination === 'llm.completions'
        ? { text: `mock-completion:${body.prompt.slice(0, 180)}` }
        : { matched: true },
    echoed: {
      prompt: body.prompt.slice(0, 500),
      parameters: body.parameters,
    },
  };
}

function assertSafeUpstream(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('upstream_url');
  }
  if (url.username || url.password) throw new Error('upstream_credentials');
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('upstream_scheme');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const localhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (url.protocol === 'http:' && !localhost) throw new Error('upstream_http');
  if (
    host === '169.254.169.254' ||
    host.startsWith('169.254.') ||
    host === 'metadata.google.internal' ||
    host === '0.0.0.0'
  ) {
    throw new Error('upstream_blocked');
  }
  return url;
}

export async function forwardDispatch(input: ForwardRequest): Promise<ForwardResult> {
  const sealed = sealContext(input.claims, input.key);
  const configured = input.upstreams[input.body.destination];
  if (!configured) {
    return {
      ok: true,
      contextHashInput: sealed,
      upstream: mockUpstream(input.body, input.claims, sealed, input.key),
    };
  }

  let url: URL;
  try {
    url = assertSafeUpstream(configured);
  } catch {
    return { ok: false, code: 'upstream_error' };
  }

  const payload = JSON.stringify({
    requestId: input.body.requestId,
    destination: input.body.destination,
    prompt: input.body.prompt,
    parameters: input.body.parameters,
    metadata: input.body.metadata ?? null,
  });

  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        'content-type': 'application/json',
        'x-gateway-context': sealed,
        'x-request-id': input.body.requestId,
      },
      body: payload,
    });
    const text = await response.text();
    if (text.length > 65_536) return { ok: false, code: 'upstream_error' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, code: 'upstream_error' };
    }
    if (!response.ok) return { ok: false, code: 'upstream_error' };
    return {
      ok: true,
      contextHashInput: sealed,
      upstream: {
        mode: 'http',
        status: response.status,
        body: parsed,
      },
    };
  } catch {
    return { ok: false, code: 'upstream_error' };
  }
}
