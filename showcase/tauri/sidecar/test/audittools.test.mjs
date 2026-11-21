// Regression tests for the 2026-11-21 audit (docs/AUDIT_2026-11-21.md): the agent's tools. A fake hands helper and
// temp folders only: nothing opens, nothing shows on screen. Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Under home: commands may only write there (npm test points HOME at a temp folder).
const dir = fs.mkdtempSync(path.join(os.homedir(), 'roamies-audit-tools-'));
const log = path.join(dir, 'calls.jsonl'), fake = path.join(dir, 'hands.mjs'), handsMarker = path.join(dir, 'hands-marker.txt');
// The fake helper: logs each call; 'act' in SlowTest waits 400 ms and then leaves a marker (as a real click would).
fs.writeFileSync(fake, `import fs from 'node:fs'; const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(a) + '\\n');
const win = { id: 7, app: 'TextEdit', title: 'notes.txt', bounds: [0, 0, 800, 600] };
let o = { ok: true, window: win };
if (a[0] === 'act') { const p = JSON.parse(a[1]); if (p.app === 'SlowTest') { await new Promise((r) => setTimeout(r, 400)); fs.writeFileSync(${JSON.stringify(handsMarker)}, 'x'); } o = { ok: true, done: p.steps.map((s) => s.do), window: win }; }
if (a[0] === 'ui') o = { ok: true, window: win, controls: [], texts: [], note: 'Nothing to list.' };
if (a[0] === 'locate') o = { ok: true, window: win };
if (a[0] === 'capture') { fs.writeFileSync(a[1], 'x'); o = { ok: true, file: a[1], window: win, pixels: [800, 600] }; }
console.log(JSON.stringify(o));
`);
process.env.ROAMIES_HANDS = fake;
const { createTools, filterSearchOutput } = await import('../tools.mjs');
const noop = async () => {};
const base = { allowActions: () => true, ui: () => {}, openUrl: noop, onCommitments: noop, showList: noop, fmtWhen: String, commitmentsText: () => '', userName: 'Test' };
const make = (o = {}) => { const asked = []; const { tools } = createTools({ ...base, ask: async (q) => { asked.push(q.placeholder); return o.answer ?? null; }, ...o }); return { tool: (n) => tools.find((t) => t.name === n), asked }; };
const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const isWin = process.platform === 'win32';

// ---------- F03: search_files never shows what's inside a protected file under the folder searched ----------
{
  const proj = path.join(dir, 'project');
  fs.mkdirSync(path.join(proj, 'sub', '.ssh'), { recursive: true });
  fs.mkdirSync(path.join(proj, 'keys'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'notes.txt'), 'TOKEN_AUDIT in plain notes\n');
  fs.writeFileSync(path.join(proj, 'private.pem'), 'TOKEN_AUDIT secret key\n');
  fs.writeFileSync(path.join(proj, 'keys', 'Server.KEY'), 'TOKEN_AUDIT secret key 2\n');
  fs.writeFileSync(path.join(proj, '.env'), 'TOKEN_AUDIT=hunter2\n');
  fs.writeFileSync(path.join(proj, 'sub', '.ssh', 'config'), 'TOKEN_AUDIT host\n');
  const { tool } = make();
  const out = await tool('search_files').execute({ pattern: 'TOKEN_AUDIT', dir: proj });
  assert.match(out, /notes\.txt/, `the plain file is found: ${out}`);
  assert.doesNotMatch(out, /secret key|hunter2|host|private\.pem|Server\.KEY|\.env|\.ssh/, `protected files stay out of the results: ${out}`);
  // The filter itself, for ripgrep's and grep's output with --null (path, NUL, line:text), Windows paths included.
  const home = os.homedir();
  const raw = [`${path.join(proj, 'notes.txt')}\u00003:ok`, `${path.join(proj, 'a.PEM')}\u00001:leak`, `${path.join(home, '.GG', 'auth.json')}\u00001:leak`].join('\n');
  const kept = filterSearchOutput(raw);
  assert.ok(kept.includes('notes.txt:3:ok') && !kept.includes('leak'), `filter keeps only allowed files: ${kept}`);
  console.log('F03 search_files: ok');
}

// ---------- F05: Stop stops a running command and a running hands step ----------
{
  const marker = path.join(dir, 'cmd-marker.txt');
  // node -e: the same on every OS. Writes its marker (in the working folder) after 400 ms unless it is killed first.
  const cmdFor = (name) => `node -e "setTimeout(()=>require('fs').writeFileSync('${name}','x'),400)"`;
  const command = cmdFor('cmd-marker.txt');
  const { tool } = make({ skipAllow: () => true, workdir: dir });
  // Control: not stopped, the same command does leave its marker (so the checks below prove the stop).
  await tool('run_command').execute({ command: cmdFor('control-marker.txt') }, {});
  assert.ok(fs.existsSync(path.join(dir, 'control-marker.txt')), 'control: the command runs and writes its marker');
  const ac = new AbortController();
  const p = tool('run_command').execute({ command }, { signal: ac.signal }).catch((e) => e);
  setTimeout(() => ac.abort(), 100);
  assert.match(String(await p), /Stopped/, 'the command was ended, not refused');
  await settle(900);
  assert.ok(!fs.existsSync(marker), 'run_command: aborted at 100 ms, so no marker at 400 ms');
  // An abort that comes while the Allow question is open: the yes arrives too late, nothing runs.
  const ac2 = new AbortController();
  const late = make({ workdir: dir, ask: async () => { ac2.abort(); return 'Allow'; } }).tool('run_command');
  await assert.rejects(late.execute({ command: cmdFor('late-marker.txt') }, { signal: ac2.signal }), /stop/i, 'a stopped request does not run after its yes');
  await settle(700);
  assert.ok(!fs.existsSync(path.join(dir, 'late-marker.txt')), 'nothing ran after the stop');
  // The hands helper is stopped too.
  const h = make({ skipAllow: () => true });
  const ac3 = new AbortController();
  const hp = h.tool('act_in_app').execute({ target: 'SlowTest', steps: [{ do: 'scroll', direction: 'down' }] }, { signal: ac3.signal }).catch((e) => e);
  setTimeout(() => ac3.abort(), 100);
  await hp;
  await settle(700);
  assert.ok(!fs.existsSync(handsMarker), 'act_in_app: aborted at 100 ms, so the helper left no marker');
  console.log('F05 abort: ok');
}

// ---------- F06: Return and coordinate clicks ask first when their effect is unknown; risky asks ignore Skip Allow ----------
// The hands helper acts in apps on macOS and Windows only (on Linux screenshots don't go through it), as in hands.test.
if (!['darwin', 'win32'].includes(process.platform)) console.log('F06 confirmations: skipped (macOS and Windows only)');
else {
  const acts = () => calls().filter((c) => c[0] === 'act');
  // Skip Allow on, and the user says no: a Delete click still asks, and nothing runs.
  fs.writeFileSync(log, '');
  let t = make({ skipAllow: () => true });
  await assert.rejects(t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'click_text', text: 'Delete' }] }, {}), /said no/);
  assert.equal(t.asked.length, 1, 'a risky click asks even with Skip Allow on');
  assert.equal(acts().length, 0, 'and nothing ran after the no');
  // Typing a message and pressing Return sends it: that asks.
  fs.writeFileSync(log, '');
  t = make();
  await assert.rejects(t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'fill', field: 'Message', text: 'hi' }, { do: 'key', key: 'return' }] }, {}), /said no/);
  assert.equal(t.asked.length, 1, 'Return after filling a message asks');
  assert.equal(acts().length, 0);
  // A bare Return (whatever is focused) asks too, and so does ctrl+enter.
  for (const key of ['return', 'enter', 'ctrl+enter', 'cmd+return']) {
    fs.writeFileSync(log, '');
    t = make({ skipAllow: () => true });
    await assert.rejects(t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'key', key }] }, {}), /said no/, `${key} alone asks`);
    assert.equal(acts().length, 0);
  }
  // Return in a search box only searches: no question.
  fs.writeFileSync(log, '');
  t = make();
  await t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'fill', field: 'Search', text: 'cats' }, { do: 'key', key: 'return' }] }, {});
  assert.equal(t.asked.length, 0, 'Return after filling a search box needs no yes');
  assert.equal(acts().length, 1);
  assert.equal(JSON.parse(acts()[0][1]).steps[1].confirmed, true, 'the helper is told the Return was cleared');
  // Tab and Escape don't activate anything.
  fs.writeFileSync(log, '');
  t = make();
  await t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'key', key: 'tab' }, { do: 'key', key: 'escape' }] }, {});
  assert.equal(t.asked.length, 0);
  // A click at screenshot pixels: what it hits is unknown, so it asks (Skip Allow or not); a yes lets it run.
  fs.writeFileSync(log, '');
  t = make({ skipAllow: () => true });
  await t.tool('take_screenshot').execute({ target: 'TextEdit' }, {});
  await assert.rejects(t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'click_at', x: 10, y: 10 }] }, {}), /said no/);
  assert.equal(acts().length, 0, 'click_at did not run after the no');
  t = make({ answer: 'Allow' });
  await t.tool('take_screenshot').execute({ target: 'TextEdit' }, {});
  await t.tool('act_in_app').execute({ target: 'TextEdit', steps: [{ do: 'click_at', x: 10, y: 10 }] }, {});
  assert.equal(t.asked.length, 1);
  assert.equal(JSON.parse(acts().at(-1)[1]).steps[0].confirmed, true);
  console.log('F06 confirmations: ok');
}

fs.rmSync(dir, { recursive: true, force: true });
console.log('audit tools ok');
void isWin;
