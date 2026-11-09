// Types for the morning digest (plan.md § 1). The reader that fills these
// rows is issue #4; this file only fixes the shape everyone builds against.

/** Status of one run event in `runs/<night>.jsonl`. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One parsed JSONL line from a night's run log. */
export type RunEvent = {
  /** ISO timestamp, offset kept exactly as logged (styleguide: no UTC conversion). */
  at: string;
  job: string;
  status: RunStatus;
  /** `null` in the log; the page renders it as `—`. */
  owner: string | null;
  error?: string;
};

/** One night's log collapsed to a single row per job. */
export type DigestRow = {
  job: string;
  /** `null` renders as `—`, never dropped. */
  owner: string | null;
  /** Parsed events for this job. */
  runs: number;
  /** Events with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** Error of the last event, `null` if it had none. */
  lastError: string | null;
  /** ISO timestamps, offsets kept as logged. */
  firstAt: string;
  lastAt: string;
};

/**
 * Reads `runs/<night>.jsonl` into one `DigestRow` per job, sorted by job.
 * A line that doesn't parse is counted, never thrown: the night still
 * renders. A night with no file is the caller's 404, not this reader's.
 *
 * Signature only — implemented by issue #4.
 */
export function readNight(runsDir: string, night: string): DigestRow[] {
  throw new Error(`readNight(${runsDir}, ${night}): not implemented (issue #4)`);
}
