import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { readNight, type DigestRow } from './digest/types.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';
import { DigestPage } from './views/digest.js';

// types.ts: "a night with no file is the caller's 404" — the reader (issue #4)
// throws, this route maps that to a 404 page. Parse errors never reach here.
function isNightNotFound(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (e as NodeJS.ErrnoException).code === 'ENOENT' || /no such night|night not found/i.test(e.message);
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    let rows: DigestRow[];
    try {
      rows = readNight(config.runsDir, night);
    } catch (e) {
      if (!isNightNotFound(e)) throw e;
      c.status(404);
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <h1>digest · {night}</h1>
          <p class="warn">no such night</p>
        </Layout>,
      );
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={night} rows={rows} />
      </Layout>,
    );
  });

  return app;
}
