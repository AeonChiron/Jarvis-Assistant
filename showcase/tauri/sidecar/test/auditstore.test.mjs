// Regression tests for the 2026-11-21 audit (docs/AUDIT_2026-11-21.md): storage. Temp folders only. Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeJson } from '../store.mjs';
import { createSecrets } from '../secrets.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roamies-audit-store-'));

// F09: a failed write reaches the caller, and the next write to the same file still works.
{
  const file = path.join(dir, 'x.json');
  fs.mkdirSync(file); // a folder where the file should go: the rename fails
  const err = console.error; console.error = () => {};
  try { await assert.rejects(writeJson(file, { a: 1 }), 'a failed write rejects'); } finally { console.error = err; }
  fs.rmSync(file, { recursive: true });
  await writeJson(file, { a: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 2 }, 'the queue recovers after a failure');
  console.log('F09 writeJson: ok');
}

// F10: saves at the same time all land; an unreadable store is not taken for an empty one.
{
  const dataDir = path.join(dir, 'secrets');
  // A fake DPAPI: seal/unseal pass the value through after a random delay, so saves overlap.
  const exec = async (cmd, args, input) => { await new Promise((r) => setTimeout(r, Math.random() * 30)); return { code: 0, stdout: input }; };
  const s = createSecrets({ platform: 'win32', dataDir, exec });
  const names = Array.from({ length: 12 }, (_, i) => `key-${i}`);
  await Promise.all(names.map((n) => s.set(n, `v-${n}`)));
  for (const n of names) assert.equal(await s.get(n), `v-${n}`, `${n} kept after concurrent saves`);
  // A store that can't be read (corrupt): a new save fails instead of wiping every other key.
  const file = path.join(dataDir, 'secrets.json');
  fs.writeFileSync(file, '{ not json');
  await assert.rejects(s.set('key-new', 'v'), 'saving into an unreadable store fails');
  assert.equal(fs.readFileSync(file, 'utf8'), '{ not json', 'the unreadable store is left as it was');
  // No temp files left behind.
  assert.deepEqual(fs.readdirSync(dataDir).filter((f) => f.endsWith('.tmp')), []);
  console.log('F10 secrets: ok');
}

fs.rmSync(dir, { recursive: true, force: true });
console.log('audit store ok');
