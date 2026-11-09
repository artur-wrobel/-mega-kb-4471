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

// The reader lives in read.ts (issue #4); re-exported here so section 2
// builds against this one module. Docs travel with the implementation.
export { NightNotFound, readNight } from './read.js';
