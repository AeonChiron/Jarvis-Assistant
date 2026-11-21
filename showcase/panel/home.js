// Jarvis Assistant's home window: the panel as a real app page, with a HUD beside it (the big JARVIS globe in
// rotating rings, the clock, what it's doing, quick actions). main.rs's show_home sets window.ROAMIE_HOME; a plain
// browser gets it with ?home. The selected companion lives here at every window size.
// Everywhere (the tray panel too): a soft click sound on buttons while Sound effects is on.
(() => {
  'use strict';
  const invoke = window.__TAURI__?.core?.invoke ?? (() => Promise.resolve());
  const send = (msg) => invoke('sidecar_send', { msg }).catch(() => {});

  // ---------------------------------------------------------------- click sounds
  let actx = null;
  function tick() {
    if (window.__panelState && window.__panelState.sound === false) return;
    try {
      actx = actx || new AudioContext();
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1900, t);
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 0.08);
    } catch { /* no audio */ }
  }
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button, [role="switch"], select, .chip')) tick(); }, true);

  if (!(window.ROAMIE_HOME || new URLSearchParams(location.search).has('home'))) return;

  // ---------------------------------------------------------------- the HUD
  document.body.classList.add('home');
  document.title = 'Jarvis Assistant';
  const hud = document.createElement('section');
  hud.className = 'hud';
  hud.setAttribute('aria-label', 'Jarvis Assistant');
  hud.innerHTML = `
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <canvas class="hud-globe" aria-hidden="true"></canvas>
    <canvas class="hud-avatar" aria-label="Selected companion" hidden></canvas>
    <div class="hud-rings" aria-hidden="true"><svg viewBox="-100 -100 200 200">
      <g class="r1"><circle r="96" fill="none" stroke="rgba(120,255,226,.32)" stroke-width=".6" stroke-dasharray="2 6"/></g>
      <g class="r2"><circle r="88" fill="none" stroke="rgba(120,255,226,.48)" stroke-width="1.2" stroke-dasharray="60 25 8 25"/></g>
      <g class="r3"><circle r="80" fill="none" stroke="rgba(120,255,226,.2)" stroke-width=".5"/>
        <path d="M0 -80V-73M80 0H73M0 80V73M-80 0H-73" stroke="rgba(120,255,226,.7)" stroke-width="1.2"/></g>
    </svg></div>
    <div class="hud-top">
      <b class="hud-name">J.A.R.V.I.S.</b>
      <span class="hud-clock"></span><span class="hud-date"></span>
      <span class="hud-status"></span>
      <span class="hud-read"></span>
    </div>
    <div class="hud-quick">
      <button class="px btn ghost" type="button" data-q="talk">Talk</button>
      <button class="px btn ghost" type="button" data-q="ask">Type</button>
      <button class="px btn ghost" type="button" data-q="buddy">Minimize to buddy</button>
      <button class="px btn ghost" type="button" data-q="full">Full screen</button>
    </div>
    <div class="hud-companion">
      <button class="px btn ghost" type="button" data-q="characters">Choose character</button>
      <label class="hud-framing" hidden>View <select aria-label="Companion framing"><option value="body">Full body</option><option value="head">Close-up</option></select></label>
      <span class="hud-avatar-status" role="status"></span>
    </div>`;
  document.body.prepend(hud);
  const $ = (s) => hud.querySelector(s);

  // Clock and date
  const clock = () => {
    const d = new Date();
    $('.hud-clock').textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('.hud-date').textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  };
  setInterval(clock, 1000);
  clock();

  // What it's doing, from the panel's state (panel.js keeps window.__panelState)
  const mood = (s) => {
    const t = `${s?.status?.state ?? ''} ${s?.status?.text ?? ''}`.toLowerCase();
    if (!s) return 'offline';
    if (/listen|hear/.test(t)) return 'listening';
    if (/speak|talk|say/.test(t)) return 'speaking';
    if (s.busy || /think|work|busy|run/.test(t)) return 'thinking';
    if (/off|error|stopp/.test(t)) return 'muted';
    return 'idle';
  };
  const read = () => {
    const s = window.__panelState;
    $('.hud-status').textContent = s?.status?.text ?? 'Starting…';
    const model = s?.model?.label ?? s?.model?.name ?? s?.modelName ?? '';
    $('.hud-read').innerHTML = `System <em>${s ? 'online' : 'starting'}</em>`
      + (model ? `<br>Model <em>${String(model).slice(0, 28)}</em>` : '')
      + `<br>Version <em>${s?.version ?? '…'}</em>`;
  };
  setInterval(read, 1000);
  read();

  const globe = window.createLedOrb?.($('.hud-globe'));
  let companion = null, selected = null, lastFrame = performance.now(), full = false;
  let meter = { level: 0, emotion: 'neutral', at: 0 };
  window.__companionMeter = (m) => { meter = { ...m, at: performance.now() }; };
  window.__companionAction = (m) => { if (companion && ['gesture', 'reaction', 'emotion'].includes(m.action)) companion[m.action](m.name); };
  let framing = 'body';
  try { framing = localStorage.getItem('companionFraming') === 'head' ? 'head' : 'body'; } catch {}
  $('.hud-framing select').value = framing;
  $('.hud-framing select').onchange = (e) => {
    framing = e.target.value; companion?.framing(framing);
    try { localStorage.setItem('companionFraming', framing); } catch {}
  };
  const frame = (now) => {
    const look = window.__panelState?.look ?? 'classic';
    const is3d = window.JarvisCompanion?.isCharacter(look);
    if (look !== selected) {
      selected = look;
      if (is3d) {
        try {
          companion ??= JarvisCompanion.mount($('.hud-avatar'));
          companion.framing(framing); companion.load(look);
        } catch (error) { $('.hud-avatar-status').textContent = '3D rendering unavailable on this device.'; console.error(error); }
      } else if (companion) {
        companion.dispose(); companion = null;
        const canvas = $('.hud-avatar');
        canvas.replaceWith(canvas.cloneNode(false));
        $('.hud-avatar-status').textContent = '';
      }
    }
    const show = is3d && companion;
    $('.hud-avatar').hidden = !show;
    $('.hud-globe').hidden = !!show;
    $('.hud-rings').hidden = !!show;
    $('.hud-framing').hidden = !show;
    if (!document.hidden) {
      if (show) {
        companion.speaking(now - meter.at < 300 ? meter.level : 0);
        companion.emotion(now - meter.at < 300 ? meter.emotion : 'neutral');
        companion.render((now - lastFrame) / 1000);
        $('.hud-avatar-status').textContent = companion.error ? 'Character failed to load. Choose another character to retry.' : companion.ready ? '' : 'Loading character…';
      } else globe?.render(mood(window.__panelState), 0, Math.min(innerWidth, innerHeight));
    }
    lastFrame = now; requestAnimationFrame(frame);
  };
  hud.addEventListener('pointermove', (e) => companion?.cursor(e.clientX, e.clientY));
  addEventListener('pagehide', () => companion?.dispose());
  requestAnimationFrame(frame);

  const setFull = (on) => {
    full = on;
    document.body.classList.toggle('fs', on);
    $('[data-q="full"]').textContent = on ? 'Exit full screen' : 'Full screen';
    invoke('home_full', { on }).catch(() => {});
  };
  hud.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q === 'talk') send({ type: 'cli', action: 'talk' });
    else if (q === 'ask') send({ type: 'cli', action: 'ask' });
    else if (q === 'full') setFull(!full);
    else if (q === 'characters') document.getElementById('nav-appearance')?.click();
    else if (q === 'buddy') invoke('home_minimize').catch((error) => { $('.hud-avatar-status').textContent = 'Could not minimize to buddy.'; console.error(error); });
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'F11') { e.preventDefault(); setFull(!full); }
    else if (e.key === 'Escape' && full) { e.preventDefault(); e.stopPropagation(); setFull(false); }
  }, true);
})();
