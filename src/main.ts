import { upstreamsFromEnv } from './config.js';
import { createGateway } from './gateway/create-gateway.js';
import { createHttpServer } from './http/server.js';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const gateway = await createGateway({ upstreams: upstreamsFromEnv() });
const server = createHttpServer(gateway);

server.listen(port, host, () => {
  process.stdout.write(`${JSON.stringify({ event: 'listen', host, port })}\n`);
});
