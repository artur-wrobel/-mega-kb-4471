import { describe, expect, it } from 'vitest';
import { renderToString } from 'hono/jsx/dom/server';
import { DigestPage } from '../src/views/digest.js';
import type { DigestRow } from '../src/digest/types.js';

const row = (over: Partial<DigestRow>): DigestRow => ({
  job: 'job',
  owner: 'rook',
  runs: 1,
  retries: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T23:00:02+01:00',
  lastAt: '2026-10-28T23:00:02+01:00',
  ...over,
});

describe('digest view', () => {
  it('renders nothing ran for an empty night', async () => {
    const html = await renderToString(<DigestPage night="2026-10-28" rows={[]} />);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('sorts by job, marks retries >= 3 and fails, keeps null owner as —', async () => {
    const html = await renderToString(
      <DigestPage
        night="2026-10-28"
        rows={[
          row({ job: 'z/last', owner: null }),
          row({ job: 'a/first', retries: 3, lastStatus: 'fail', lastError: 'upstream 503' }),
        ]}
      />,
    );
    expect(html.indexOf('a/first')).toBeLessThan(html.indexOf('z/last'));
    expect(html).toContain('class="warn"');
    expect(html).toContain('—');
    // Times keep their logged offset, never converted.
    expect(html).toContain('2026-10-28T23:00:02+01:00');
  });
});
