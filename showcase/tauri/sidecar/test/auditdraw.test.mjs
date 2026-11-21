// Regression tests for the 2026-11-21 audit (docs/AUDIT_2026-11-21.md): pictures fetched for drawings. No network:
// fetch and DNS are fakes. Run: npm test
import assert from 'node:assert/strict';
import { LIMITS, photoFor } from '../draw.mjs';

const png = (body, headers = {}) => new Response(body, { status: 200, headers: { 'content-type': 'image/png', ...headers } });
// DNS: evil.test and bounce.test point at this computer / the local network; good.test is public.
const lookup = async (host) => [{ address: host === 'good.test' ? '93.184.216.34' : host === 'evil.test' ? '127.0.0.1' : '192.168.1.10', family: 4 }];

// F11: a public-looking name that leads to this computer or the local network is refused, also after a redirect.
{
  let fetched = 0;
  const fetchImpl = async (url) => { fetched++; return new URL(url).hostname === 'good.test' ? new Response(null, { status: 302, headers: { location: 'https://bounce.test/a.png' } }) : png('x'); };
  await assert.rejects(photoFor({ url: 'https://evil.test/a.png' }, { fetchImpl, lookup }), /Blocked for safety/, 'a name that resolves to 127.0.0.1');
  assert.equal(fetched, 0, 'nothing was fetched from it');
  await assert.rejects(photoFor({ url: 'https://good.test/a.png' }, { fetchImpl, lookup }), /Blocked for safety/, 'a redirect to a local-network name');
  assert.equal(fetched, 1, 'only the first, public hop was fetched');
  const ok = await photoFor({ url: 'https://good.test/b.png' }, { fetchImpl: async () => png('pic'), lookup });
  assert.match(ok.src, /^data:image\/png;base64,/);
  console.log('F11 DNS check: ok');
}

// F12: a body with no size header is read only up to the limit, then the download is cancelled.
{
  let sent = 0, cancelled = false;
  const chunk = new Uint8Array(64 * 1024);
  const body = new ReadableStream({
    pull(c) { if (sent > LIMITS.photoBytes * 20) return c.close(); sent += chunk.length; c.enqueue(chunk); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(photoFor({ url: 'https://good.test/huge.png' }, { fetchImpl: async () => png(body), lookup }), /too big/);
  assert.ok(cancelled, 'the download was cancelled at the limit');
  assert.ok(sent <= LIMITS.photoBytes + 2 * chunk.length, `read ${sent} bytes, limit ${LIMITS.photoBytes}`);
  console.log('F12 size limit while streaming: ok');
}

console.log('audit draw ok');
