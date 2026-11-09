import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/types.js';
import type { RigConfig } from '../src/config.js';

// Route tests go through app.request() (styleguide), on temp runs dirs with
// synthetic nights; runs/ itself is read-only.
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A runs dir with `<night>.jsonl` holding the given lines; returns its path. */
function night(lines: string[], name = '2026-11-01'): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  dirs.push(dir);
  writeFileSync(join(dir, `${name}.jsonl`), lines.join('\n') + '\n');
  return dir;
}

/** The app under test, pointed at the given runs dir. */
function app(runsDir: string) {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

const ev = (at: string, job: string, status: 'ok' | 'retry' | 'fail', owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

// Out-of-file-order events over jobs whose names aren't prefixes of each
// other (so indexOf tells the table order) — sorted order is derived, not listed by eye.
const rows = () => [
  ev('2026-11-01T05:00:00Z', 'rig/rotate-logs', 'ok', 'lane-07'),
  ev('2026-11-01T01:00:00Z', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
  ev('2026-11-01T01:05:00Z', 'fixtures/refresh', 'ok', 'rook'),
  ev('2026-11-01T04:00:01Z', 'notes/backup', 'fail', 'lane-07', 'quota exceeded'),
  ev('2026-11-01T02:00:00Z', 'digest/render', 'ok', null),
  ev('2026-11-01T03:00:00Z', 'lane/sync', 'ok', 'rook'),
];

describe('GET /digest/:night', () => {
  it('renders 200 with every job, sorted like the JSON', async () => {
    const dir = night(rows());
    const res = await app(dir).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    // Expected jobs derived from the reader, not listed by eye.
    for (const row of readNight(dir, '2026-11-01')) {
      expect(html).toContain(row.job);
    }
    // The page's table is in the JSON's order: each job appears after the previous one.
    const at = readNight(dir, '2026-11-01').map((row) => html.indexOf(row.job));
    expect(at.every((pos, i) => pos !== -1 && (i === 0 || pos > at[i - 1]!))).toBe(true);
  });

  it('answers 404 for a night with no file', async () => {
    const dir = night(rows());
    const res = await app(dir).request('/digest/2026-12-24');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no such night');
  });

  it('renders nothing ran for the empty night', async () => {
    const dir = night(['']);
    const res = await app(dir).request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the parsed rows around a bad line', async () => {
    const dir = night([
      '{"at":"2026-11-01T01:00:00Z","job":"a/sy', // truncated, like the fixture's bad line
      ev('2026-11-01T02:00:00Z', 'lane/sync', 'ok', 'rook'),
      'not json at all',
      ev('2026-11-01T03:00:00Z', 'digest/render', 'ok', null),
    ]);
    const res = await app(dir).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const row of readNight(dir, '2026-11-01')) {
      expect(html).toContain(row.job);
    }
  });
});

describe('GET /api/digest/:night', () => {
  it("answers 200 with the same rows, in the page's order", async () => {
    const dir = night(rows());
    const jsonRes = await app(dir).request('/api/digest/2026-11-01');
    const pageRes = await app(dir).request('/digest/2026-11-01');
    expect(jsonRes.status).toBe(200);
    const json = (await jsonRes.json()) as ReturnType<typeof readNight>;
    // Expected rows derived from the reader on the same dir, not listed by eye.
    expect(json).toEqual(readNight(dir, '2026-11-01'));
    // Same order as the page's table: job positions in the HTML strictly increase.
    const html = await pageRes.text();
    const at = json.map((row) => html.indexOf(row.job));
    expect(at.every((pos, i) => pos !== -1 && (i === 0 || pos > at[i - 1]!))).toBe(true);
  });

  it('answers 404 for a night with no file', async () => {
    const dir = night(rows());
    const res = await app(dir).request('/api/digest/2026-12-24');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no runs for 2026-12-24' });
  });

  it('answers 200 with [] for the empty night', async () => {
    const dir = night(['']);
    const res = await app(dir).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('still answers 200 with the parsed rows around a bad line', async () => {
    const dir = night([
      '{"at":"2026-11-01T01:00:00Z","job":"a/sy',
      ev('2026-11-01T02:00:00Z', 'lane/sync', 'ok', 'rook'),
      'not json at all',
      ev('2026-11-01T03:00:00Z', 'digest/render', 'ok', null),
    ]);
    const res = await app(dir).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readNight(dir, '2026-11-01'));
  });
});
