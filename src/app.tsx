import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/types.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  // Same source call as the page (issue #5): readNight sorts by job, so the
  // page and this JSON can't disagree (ADR 0001). A night with no file is the
  // caller's 404 (types.ts), so it's checked here, before the reader runs.
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!existsSync(join(config.runsDir, `${night}.jsonl`))) {
      return c.json({ error: `no runs for ${night}` }, 404);
    }
    return c.json(readNight(config.runsDir, night));
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  return app;
}
