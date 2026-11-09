import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight, NightNotFound } from '../src/digest/types.js';

// Temp runs dirs for the synthetic nights; runs/ itself is read-only.
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

const ev = (at: string, job: string, status: 'ok' | 'retry' | 'fail', owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

describe('readNight', () => {
  it('reads the fixture night into one row per job, sorted by job', () => {
    const rows = readNight('runs', '2026-10-28');
    expect(rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(rows).toHaveLength(5);
  });

  it('collapses the fixture night to the derived rows', () => {
    // Expected values derived by running a script over runs/2026-10-28.jsonl:
    // 16 lines, 1 unparseable (truncated JSON), 15 events over 5 jobs.
    expect(readNight('runs', '2026-10-28')).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });

  it("doesn't throw on the bad line: it's skipped, never counted into a row", () => {
    const dir = night([
      '{"at":"2026-11-01T01:00:00Z","job":"a","status":"ok","owner":null}', // fine
      '{"at":"2026-11-01T02:00:00Z","job":"a/sy', // truncated, like the fixture's bad line
      'not json at all',
      '{"at":"2026-11-01T03:00:00Z","job":"a","status":"weird","owner":null}', // parses, wrong shape
      '{"at":"2026-11-01T04:00:00Z","job":"a","status":"fail","owner":null,"error":"boom"}',
    ]);
    const [row] = readNight(dir, '2026-11-01');
    expect(row).toEqual({
      job: 'a',
      owner: null,
      runs: 2,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'boom',
      firstAt: '2026-11-01T01:00:00Z',
      lastAt: '2026-11-01T04:00:00Z',
    });
  });

  it('returns zero rows for an empty file', () => {
    const dir = night(['']);
    expect(readNight(dir, '2026-11-01')).toEqual([]);
  });

  it('keeps owner null (the page renders it as —)', () => {
    const dir = night([ev('2026-11-01T01:00:00Z', 'digest/render', 'ok', null)]);
    expect(readNight(dir, '2026-11-01')[0]?.owner).toBeNull();
  });

  it('counts retries separately from runs and keeps the last event', () => {
    const dir = night([
      ev('2026-11-01T01:00:00Z', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
      ev('2026-11-01T01:01:00Z', 'fixtures/refresh', 'retry', 'rook', 'upstream 503'),
      ev('2026-11-01T01:05:00Z', 'fixtures/refresh', 'ok', 'rook'),
    ]);
    expect(readNight(dir, '2026-11-01')[0]).toMatchObject({
      runs: 3,
      retries: 2,
      lastStatus: 'ok',
      lastError: null,
    });
  });

  it('keeps first and last time from file order, offsets as logged', () => {
    const dir = night([
      ev('2026-11-01T23:00:06+01:00', 'lane/sync', 'ok', 'rook'),
      ev('2026-11-02T02:00:33+01:00', 'lane/sync', 'ok', 'rook'),
      ev('2026-11-02T05:00:04+01:00', 'lane/sync', 'ok', 'rook'),
    ]);
    const row = readNight(dir, '2026-11-01')[0];
    expect(row?.firstAt).toBe('2026-11-01T23:00:06+01:00');
    expect(row?.lastAt).toBe('2026-11-02T05:00:04+01:00');
  });

  it('sorts rows by job regardless of file order', () => {
    const dir = night([
      ev('2026-11-01T01:00:00Z', 'rig/rotate-logs', 'ok', 'lane-07'),
      ev('2026-11-01T02:00:00Z', 'digest/render', 'ok', null),
      ev('2026-11-01T03:00:00Z', 'lane/sync', 'ok', 'rook'),
    ]);
    expect(readNight(dir, '2026-11-01').map((r) => r.job)).toEqual([
      'digest/render',
      'lane/sync',
      'rig/rotate-logs',
    ]);
  });

  it('throws NightNotFound for a night with no file, so the route can 404', () => {
    const dir = night([ev('2026-11-01T01:00:00Z', 'a', 'ok', null)], '2026-11-01');
    expect(() => readNight(dir, '2026-12-24')).toThrow(NightNotFound);
    expect(() => readNight(dir, '2026-12-24')).toThrow(/no run log for 2026-12-24/);
  });
});
