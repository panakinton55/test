import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGateway } from '../src/gateway/create-gateway.js';
import { createHttpServer } from '../src/http/server.js';

test('console and demo scenarios exercise allow and deny paths', async () => {
  const lines: string[] = [];
  const gateway = await createGateway({ demo: true, auditSink: (line) => lines.push(line), ratePerMin: 0 });
  const server = createHttpServer(gateway);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('address');
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const page = await fetch(`${base}/`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /connect-src 'self'/);
    assert.match(html, /agent-secure-gateway/);
    assert.equal(html.includes('hidden-region-value'), false);

    const health = await fetch(`${base}/api/gateway/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    assert.equal(health.demo, true);
    assert.match(health.demoAgent.did, /^did:key:z/);

    const scenarios = [
      ['allow', 200, 'forwarded'],
      ['bad_signature', 401, 'signature_invalid'],
      ['bad_zkp', 401, 'zkp_invalid'],
      ['secret', 403, 'guardrail_blocked'],
      ['injection', 403, 'guardrail_blocked'],
      ['scope', 403, 'scope_denied'],
    ] as const;

    for (const [scenario, status, code] of scenarios) {
      const response = await fetch(`${base}/api/gateway/demo/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const body = await response.json();
      assert.equal(response.status, 200, scenario);
      assert.equal(body.results[0].status, status, scenario);
      assert.equal(body.results[0].body.code, code, scenario);
    }

    const replay = await fetch(`${base}/api/gateway/demo/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: 'replay' }),
    }).then((response) => response.json());
    assert.equal(replay.results[0].status, 200);
    assert.equal(replay.results[1].body.code, 'replay');

    const missing = await fetch(`${base}/api/gateway/dispatch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(missing.status, 401);

    const audit = await fetch(`${base}/api/gateway/audit`).then((response) => response.json());
    assert.equal(audit.chainValid, true);
    assert.equal(audit.length > 0, true);
    const serialized = JSON.stringify(audit) + lines.join('\n');
    assert.equal(serialized.includes('sk-DEMOINVALIDKEY000000'), false);
    assert.equal(gateway.audit.verify(), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
