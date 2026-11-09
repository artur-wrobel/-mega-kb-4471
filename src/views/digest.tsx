import type { DigestRow } from '../digest/types.js';

// Markers are server-rendered text/class (ADR 0001): a fetch and a screenshot
// see the same flagged rows. Threshold: retries >= 3 (plan.md § 2a).
function flagged(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function DigestPage({ night, rows }: { night: string; rows: DigestRow[] }) {
  const sorted = [...rows].sort((a, b) => a.job.localeCompare(b.job));
  return (
    <>
      <h1>digest · {night}</h1>
      {sorted.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first at</th>
              <th>last at</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr>
                <td>{row.job}</td>
                {/* Missing data is `—`, never an empty cell (styleguide). */}
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td class={flagged(row) ? 'warn' : undefined}>{row.retries}</td>
                <td class={flagged(row) ? 'warn' : undefined}>
                  {row.lastStatus}
                  {flagged(row) ? ' !' : ''}
                </td>
                <td>{row.lastError ?? '—'}</td>
                {/* Timestamps keep their logged offsets (styleguide). */}
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
