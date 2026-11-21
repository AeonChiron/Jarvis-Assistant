// A small X on the desktop character while the pointer is on it: it puts the character away. As the buddy (the app
// window minimized into it) the buddy is the app, so its X closes Jarvis Assistant, like the window's own close.
(() => {
  const R = window.Roamie;
  if (!R?.ptr) return;
  const SIZE = 22;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '×';
  btn.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;height:${SIZE}px;padding:0;margin:0;display:none;z-index:10;
    font:600 15px/1 "Martian Mono",monospace;color:#78ffe2;background:rgba(6,22,26,.92);border:1px solid #78ffe2;
    border-radius:4px;box-shadow:0 0 8px rgba(120,255,226,.55);cursor:pointer;`;
  document.body.appendChild(btn);
  let x = 0, y = 0, shown = false, until = 0, cursor = null;
  const body = () => {
    const c = R.tiles?.find((t) => t.creature.agent)?.creature;
    return c && c.agent.visible ? c : null;
  };
  const onX = (px, py) => shown && px >= x - 4 && px <= x + SIZE + 4 && py >= y - 4 && py <= y + SIZE + 4;
  const update = () => {
    const c = body(), now = performance.now();
    if (c && cursor) {
      const m = c.mover;
      x = m.x + m.radius * 0.62; y = m.y - m.radius * 0.95;
      if (Math.hypot(cursor[0] - m.x, cursor[1] - m.y) < m.radius * 1.3 || onX(cursor[0], cursor[1])) until = now + 700;
    }
    const on = !!c && now < until;
    if (on !== shown) { shown = on; btn.style.display = on ? 'block' : 'none'; }
    if (on) btn.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    btn.title = R.buddyMode ? 'Close Jarvis Assistant' : 'Hide character';
    btn.setAttribute('aria-label', btn.title);
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
  // The shell sends the cursor through R.ptr (over other apps too); its answer decides whether a click lands here.
  const ptr = R.ptr;
  R.ptr = (px, py, t) => { cursor = [px, py]; return ptr(px, py, t) || onX(px, py); };
  const hitTest = R.hitTest;
  R.hitTest = (px, py) => hitTest(px, py) || onX(px, py);
  addEventListener('pointermove', (e) => { cursor = [e.clientX, e.clientY]; });
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    until = 0;
    const invoke = window.__TAURI__?.core?.invoke;
    if (R.buddyMode && invoke) { invoke('sidecar_send', { msg: { type: 'menu', id: 'quit' } }).catch(console.error); return; }
    body()?.agent.hide();
  });
})();
