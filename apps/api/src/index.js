import http from 'node:http';
import { connectMongo } from '@judgebox/shared';
import { config } from './config.js';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';

async function main() {
  await connectMongo(config.mongoUrl);
  const app = createApp();
  const server = http.createServer(app);
  attachRealtime(server);
  server.listen(config.port, () => console.log(`[api] listening on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('[api] fatal:', err.message);
  process.exit(1);
});
