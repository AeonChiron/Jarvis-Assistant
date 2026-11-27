import assert from 'node:assert/strict';
import { checkUpstream, SYNCED } from '../upstream.mjs';

const reply = (status, body) => async (url) => { reply.url = url; return { ok: status === 200, status, json: async () => body }; };

// New commits since the sync point, leaving out the synced one (GitHub's since is inclusive).
let r = await checkUpstream(reply(200, [{ sha: 'b', commit: { message: 'Faster wake word\n\nDetails' } }, { sha: 'a' }, { sha: SYNCED.sha }]));
assert.deepEqual(r, { ok: true, count: 2, latest: 'Faster wake word' });
assert.match(reply.url, /repos\/KenKaiii\/Roamies\/commits\?sha=main&per_page=100&since=/);
r = await checkUpstream(reply(200, [{ sha: SYNCED.sha }]));
assert.deepEqual(r, { ok: true, count: 0, latest: '' });
r = await checkUpstream(reply(403, {}));
assert.equal(r.ok, false); assert.match(r.error, /limiting/);
r = await checkUpstream(async () => { throw new Error('offline'); });
assert.deepEqual(r, { ok: false, error: "Couldn't reach GitHub." });
console.log('upstream: ok');
