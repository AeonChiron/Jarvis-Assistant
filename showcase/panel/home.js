// Jarvis Assistant's home window: the panel as a real app page, with a HUD beside it (the big JARVIS globe in
// rotating rings, the clock, what it's doing, quick actions). main.rs's show_home sets window.ROAMIE_HOME; a plain
// browser gets it with ?home. Full screen (the button, F11, Esc to leave) can bring the animama companion along.
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
      <button class="px btn ghost" type="button" data-q="full">Full screen</button>
    </div>
    <label class="hud-companion"><input type="checkbox" class="hud-comp"> Animama companion in full screen</label>`;
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

  // The globe
  const globe = window.createLedOrb?.($('.hud-globe'));
  const frame = () => {
    if (globe) globe.render(mood(window.__panelState), 0, Math.min(innerWidth, innerHeight));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Full screen, and the companion that only comes along in full screen
  let full = false, comp = true;
  try { comp = localStorage.getItem('homeCompanion') !== 'off'; } catch { /* private mode */ }
  $('.hud-comp').checked = comp;
  $('.hud-comp').onchange = (e) => {
    comp = e.target.checked;
    try { localStorage.setItem('homeCompanion', comp ? 'on' : 'off'); } catch { /* private mode */ }
    if (full) invoke('home_full', { on: true, companion: comp }).catch(() => {});
  };
  const setFull = (on) => {
    full = on;
    document.body.classList.toggle('fs', on);
    $('[data-q="full"]').textContent = on ? 'Exit full screen' : 'Full screen';
    invoke('home_full', { on, companion: comp }).catch(() => {});
  };
  hud.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q === 'talk') send({ type: 'cli', action: 'talk' });
    else if (q === 'ask') send({ type: 'cli', action: 'ask' });
    else if (q === 'full') setFull(!full);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'F11') { e.preventDefault(); setFull(!full); }
    else if (e.key === 'Escape' && full) { e.preventDefault(); e.stopPropagation(); setFull(false); }
  }, true);
})();
