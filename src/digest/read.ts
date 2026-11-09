import { readFileSync } from 'node:fs';
import type { DigestRow, RunEvent } from './types.js';

/** Thrown when `runs/<night>.jsonl` doesn't exist — the route turns it into a 404. */
export class NightNotFound extends Error {
  constructor(runsDir: string, night: string) {
    super(`no run log for ${night} in ${runsDir}`);
    this.name = 'NightNotFound';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * One JSONL line parsed at the edge, or `null` when it doesn't parse.
 * "Doesn't parse" = not valid JSON, or valid JSON that isn't a `RunEvent`
 * (missing or mistyped `at`, `job`, `status`, `owner`, or `error`).
 */
function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || typeof job !== 'string') return null;
  if (status !== 'ok' && status !== 'retry' && status !== 'fail') return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return { at, job, status, owner, ...(error === undefined ? {} : { error }) };
}

/**
 * Reads `runs/<night>.jsonl` into one `DigestRow` per job, sorted by job.
 *
 * A line that doesn't parse is counted as skipped: it adds to no row's
 * counts and never throws — the night still renders. `DigestRow`'s shape is
 * fixed by issue #3, so the skipped count itself is not exposed; the rows
 * reflect only the lines that parsed. A night with no file throws
 * `NightNotFound` — the caller's 404, not a crash.
 *
 * `firstAt`/`lastAt` follow file order (run logs are append-ordered), and
 * `owner` is the last event's owner.
 */
export function readNight(runsDir: string, night: string): DigestRow[] {
  let text: string;
  try {
    text = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  } catch (err: unknown) {
    if (isRecord(err) && 'code' in err && err.code === 'ENOENT') {
      throw new NightNotFound(runsDir, night);
    }
    throw err;
  }

  const rows = new Map<string, DigestRow>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue; // the file's trailing newline
    const event = parseEvent(line);
    if (event === null) continue; // skipped, never thrown
    const row = rows.get(event.job);
    if (row === undefined) {
      rows.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstAt: event.at,
        lastAt: event.at,
      });
    } else {
      row.runs += 1;
      if (event.status === 'retry') row.retries += 1;
      row.owner = event.owner;
      row.lastStatus = event.status;
      row.lastError = event.error ?? null;
      row.lastAt = event.at;
    }
  }

  return [...rows.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
}
