import type { NightCounts, Status } from '../status.js';

function countsText(counts: NightCounts | null): string {
  // Unreadable night (styleguide): missing data renders as `—`, never dropped.
  if (counts === null) return 'ok — · retry — · fail —';
  return `ok ${counts.ok} · retry ${counts.retry} · fail ${counts.fail}`;
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => (
            <li>
              <a href={`/digest/${n}`}>{n}</a>
              {' · '}
              <span class="mute">{countsText(status.counts[n] ?? null)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
