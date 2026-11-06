import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import type { Gateway } from '../gateway/create-gateway.js';

const consoleHtml = readFileSync(new URL('../ui/console.html', import.meta.url));

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function send(res: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

async function readBody(req: IncomingMessage, limit: number): Promise<{ ok: true; raw: string } | { ok: false }> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limit) {
      req.destroy();
      return { ok: false };
    }
    chunks.push(buffer);
  }
  return { ok: true, raw: Buffer.concat(chunks).toString('utf8') };
}

function remoteIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

function singleHeaders(req: IncomingMessage): Record<string, string | undefined> | null {
  const names = ['content-type', 'x-did', 'x-did-signature', 'x-zkp-token', 'x-nonce', 'x-timestamp'];
  const headers: Record<string, string | undefined> = {};
  for (const name of names) {
    const value = req.headers[name];
    if (Array.isArray(value)) return null;
    headers[name] = value;
  }
  return headers;
}

export function createHttpServer(gateway: Gateway) {
  return createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

    try {
      if (method === 'GET' && path === '/') {
        send(res, 200, consoleHtml, 'text/html; charset=utf-8');
        return;
      }
      if (method === 'GET' && path === '/api/gateway/health') {
        sendJson(res, 200, gateway.health());
        return;
      }
      if (method === 'GET' && path === '/api/gateway/audit') {
        const events = gateway.audit.list().slice(-100);
        sendJson(res, 200, { ok: true, chainValid: gateway.audit.verify(), length: gateway.audit.length, events });
        return;
      }
      if (path === '/api/gateway/dispatch' && method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method_not_allowed', message: 'POSTだけを受け付けます' });
        return;
      }
      if (path === '/api/gateway/demo/run' && method !== 'POST') {
        sendJson(res, 405, { ok: false, code: 'method_not_allowed', message: 'POSTだけを受け付けます' });
        return;
      }
      if (method === 'POST' && (path === '/api/gateway/dispatch' || path === '/api/gateway/demo/run')) {
        const headers = singleHeaders(req);
        if (!headers) {
          sendJson(res, 400, { ok: false, code: 'header_missing', message: '認証ヘッダーが重複しています' });
          return;
        }
        const body = await readBody(req, gateway.maxBodyBytes);
        if (!body.ok) {
          if (!res.headersSent) {
            sendJson(res, 413, { ok: false, code: 'too_large', message: 'リクエストが上限を超えています' });
          }
          return;
        }
        if (path === '/api/gateway/demo/run') {
          let parsed: unknown = {};
          if (body.raw.length > 0) {
            try {
              parsed = JSON.parse(body.raw);
            } catch {
              sendJson(res, 400, { ok: false, code: 'payload_invalid', message: 'デモ要求が不正です' });
              return;
            }
          }
          const result = await gateway.demo(parsed, remoteIp(req));
          sendJson(res, result.status, result.body);
          return;
        }
        const result = await gateway.dispatch({ headers, rawBody: body.raw, remoteIp: remoteIp(req) });
        sendJson(res, result.status, result.body);
        return;
      }
      sendJson(res, 404, { ok: false, code: 'not_found', message: '対象が見つかりません' });
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, code: 'internal', message: 'ゲートウェイ内部で失敗しました' });
      }
    }
  });
}
