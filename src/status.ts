import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight, type DigestRow } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

/** ok / retry / fail counts for one night, shown beside the digest link. */
export type NightCounts = {
  ok: number;
  retry: number;
  fail: number;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  /** One entry per night; `null` means the night couldn't be read and renders as `—`. */
  counts: Record<string, NightCounts | null>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Count semantics, from DigestRow fields only:
 * - ok:     rows whose last run succeeded (`lastStatus === 'ok'`)
 * - retry:  total retry events in the night (sum of the rows' `retries`) — retries count
 *   even when the job eventually succeeded
 * - fail:   rows whose last run failed (`lastStatus === 'fail'`)
 * A row whose last run was a retry is counted only in `retry`, never in ok or fail.
 */
export function nightCounts(rows: DigestRow[]): NightCounts {
  return {
    ok: rows.filter((r) => r.lastStatus === 'ok').length,
    retry: rows.reduce((sum, r) => sum + r.retries, 0),
    fail: rows.filter((r) => r.lastStatus === 'fail').length,
  };
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  const counts: Record<string, NightCounts | null> = {};
  for (const night of nights) {
    // readNight (issue #4) counts bad lines itself and shouldn't throw for one; the catch
    // covers the reader not being in yet and real IO errors — the board still renders.
    try {
      counts[night] = nightCounts(readNight(config.runsDir, night));
    } catch {
      counts[night] = null;
    }
  }
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    counts,
  };
}
