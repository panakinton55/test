import { createGateway } from './gateway/create-gateway.js';

const gateway = await createGateway({
  demo: true,
  auditSink: (line) => process.stdout.write(`${line}\n`),
});
const allow = await gateway.demo({ scenario: 'allow' }, '127.0.0.1');
const injection = await gateway.demo({ scenario: 'injection' }, '127.0.0.1');
process.stdout.write(
  `${JSON.stringify({ chainValid: gateway.audit.verify(), allow, injection }, null, 2)}\n`,
);
