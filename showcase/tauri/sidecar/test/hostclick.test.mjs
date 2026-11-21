// The overlay's click-through (showcase/roamies/host.js): a button that appears under a cursor that isn't moving takes
// the click without the mouse having to move first. Regression: "Don't install" needed three presses while the
// reply was still being spoken. Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const noop = () => {};
const calls = [], timers = [];
const el = () => new Proxy({ style: {}, setAttribute: noop, addEventListener: noop, focus: noop }, { get: (t, k) => (k in t ? t[k] : noop) });
let over = false; // whether the page has something clickable under the cursor
const window = {
  __TAURI__: { core: { invoke: (cmd, args) => { calls.push([cmd, args]); return Promise.resolve(true); } } },
  Roamie: { ptr: () => over },
};
const ctx = {
  window, Roamie: window.Roamie, navigator: { platform: 'MacIntel' }, performance, Math, JSON, Promise, Set, Map, Array, Object, String, Number, RegExp, Date,
  document: { createElement: el, addEventListener: noop, body: el(), hidden: false },
  addEventListener: noop, setTimeout: noop, clearTimeout: noop, clearInterval: noop, setInterval: (f, ms) => { timers.push([f, ms]); return timers.length; },
  matchMedia: () => ({ matches: false, addEventListener: noop }), requestAnimationFrame: noop, innerWidth: 1512, innerHeight: 982,
};
vm.runInNewContext(fs.readFileSync(new URL('../../../roamies/host.js', import.meta.url), 'utf8'), ctx);
const hot = () => calls.filter(([c]) => c === 'set_hot').map(([, a]) => a.hot);
const tick = () => timers.filter(([, ms]) => ms <= 200).forEach(([f]) => f());

window.__roamiePtr(700, 120, 0);
assert.deepEqual(hot(), [false], 'nothing there: clicks go through');
over = true; // the Allow buttons grow into place under the resting cursor; the shell sends nothing new
tick();
assert.deepEqual(hot(), [false, true], 'the next check makes the window take the click');
tick();
assert.deepEqual(hot(), [false, true], 'no repeat while nothing changes');
over = false; tick();
assert.deepEqual(hot(), [false, true, false], 'and lets clicks through again once it has gone');
console.log('host click-through tests: passed');

// Regression (#108): hiding the Roamie (the summon keys) while it was talking left the voice going.
{
  let hidden = 0, hushed = 0, talking = true;
  const agent = { visible: true, hide: () => { hidden++; agent.visible = false; }, show: () => false, act: noop };
  window.Roamie.tiles = [{ creature: { agent } }];
  window.Roamie.voiceOut = { playing: () => talking, stop: () => { hushed++; talking = false; } };
  calls.length = 0;
  window.__roamieHost({ kind: 'summon' });
  assert.equal(hidden, 1);
  assert.equal(hushed, 1, 'the voice stops');
  assert.ok(calls.some(([c, a]) => c === 'sidecar_send' && a.msg.type === 'menu' && a.msg.id === 'stop'), 'the answer stops too');
  // Not talking: hiding sends no stop.
  agent.visible = true; calls.length = 0;
  window.__roamieHost({ kind: 'summon' });
  assert.ok(!calls.some(([c, a]) => c === 'sidecar_send' && a.msg.id === 'stop'));
  console.log('host hide-stops-voice tests: passed');
}

// Regression: with the app minimized into the buddy, the buddy follows the cursor, so the cursor kept landing on it
// and clicks meant for the app below went to the overlay ("my cursor isn't working").
{
  let clock = 0;
  ctx.performance = { now: () => clock };
  const mover = { x: 400, y: 300, radius: 30, dragging: false };
  window.Roamie.tiles = [{ creature: { mover, agent: { visible: true, show: noop, hide: noop, act: noop } } }];
  const state = () => hot().at(-1) ?? false;
  window.__roamieHost({ kind: 'buddy_mode', on: true });
  calls.length = 0; over = true;
  window.__roamiePtr(405, 300, 0);
  assert.equal(state(), false, 'passing over the buddy: clicks still reach the app below');
  clock += 150; window.__roamiePtr(420, 310, 0); tick();
  assert.equal(state(), false, 'still moving');
  clock += 450; tick();
  assert.equal(state(), true, 'resting on it: it takes the click (double-click to restore, its X)');
  clock += 50; window.__roamiePtr(424, 312, 0);
  assert.equal(state(), true, 'a small move for the double-click keeps it');
  over = false; window.__roamiePtr(600, 500, 0);
  assert.equal(state(), false, 'gone: clicks go through');
  over = true; mover.dragging = true; window.__roamiePtr(405, 300, 0);
  assert.equal(state(), true, 'mid-drag it keeps the mouse');
  mover.dragging = false; window.__roamiePtr(900, 700, 0); over = false; window.__roamiePtr(900, 701, 0);
  window.__roamieHost({ kind: 'buddy_mode', on: false });
  over = true; window.__roamiePtr(405, 300, 0);
  assert.equal(state(), true, 'not the buddy: the sidekick takes clicks at once, as before');
  console.log('host buddy click-through tests: passed');
}
