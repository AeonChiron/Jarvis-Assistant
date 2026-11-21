(() => {
// Jarvis's LED globe: a sphere of glowing LED points with a lit heart, rippled by his voice, drawn on a little LED
// matrix (each cell a 3x3 dot with a dark gap) and bloomed. Ported from Roamies (github.com/KenKaiii/Roamies, AGPL-3.0:
// showcase/roamies/jarvis.js for the globe, 10-dither.js for the LED matrix), coloured by Jarvis's states.
// Jarvis Assistant's home page (home.js) draws it big, coloured by what the app is doing.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Points spread evenly over a sphere (golden spiral).
const sphere = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});
const DOTS = { big: sphere(520), small: sphere(260) };

// Five brightness levels per state, dark to white-hot. Idle/speaking is Roamies' own teal.
const TEAL = [[4, 16, 18], [14, 92, 96], [40, 196, 184], [120, 255, 226], [230, 255, 250]];
const ramp = (r, g, b) => [[r * 0.04, g * 0.04, b * 0.04], [r * 0.3, g * 0.3, b * 0.3], [r * 0.72, g * 0.72, b * 0.72],
  [r, g, b], [255 - (255 - r) * 0.15, 255 - (255 - g) * 0.15, 255 - (255 - b) * 0.15]];
const PALS = {
  idle: TEAL, speaking: TEAL, listening: ramp(61, 255, 158), thinking: ramp(255, 176, 46), waiting: ramp(255, 176, 46),
  muted: ramp(255, 84, 104).map((c) => c.map((v) => v * 0.6)), offline: ramp(74, 98, 116),
};
const L = 4;   // brightest level

// 4x4 ordered dither: which back-of-the-globe points show through.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const th = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
// the lit pixels of one LED in its 6x6 cell: a disc
const DOT = [];
for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if ((i - 2.5) ** 2 + (j - 2.5) ** 2 <= 5) DOT.push([i, j]);

function createLedOrb(canvas, { detail = 1 } = {}) {
  const ctx = canvas.getContext("2d");
  const grid = document.createElement("canvas"), gctx = grid.getContext("2d");
  const bloom = document.createElement("canvas"), bctx = bloom.getContext("2d");
  const pal = TEAL.map((c) => c.slice());
  let prev = performance.now(), spin = 0, shown = 0;

  return {
    render(state, level, size) {
      const now = performance.now(), t = now / 1000, dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || size, h = canvas.clientHeight || size;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      // glide toward this state's colours in ~0.5 s
      const k = 1 - Math.exp(-dt * 5), target = PALS[state] || TEAL;
      pal.forEach((c, i) => c.forEach((v, j) => (c[j] = v + (target[i][j] - v) * k)));
      shown += ((level || 0) - shown) * 0.3;

      // The LED grid: rad cells of radius, cells P screen px wide.
      const small = detail < 0.5;
      const rad = small ? 8 : 15, P = (Math.min(w, h) * (small ? 0.42 : 0.3)) / rad;
      const gw = Math.ceil(w / P), gh = Math.ceil(h / P), cx = gw / 2, cy = gh / 2;
      const cells = new Map();            // the brightest point in each cell wins
      const put = (x, y, l) => {
        const gx = Math.round(x), gy = Math.round(y);
        if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return;
        const key = gy * gw + gx;
        if ((cells.get(key) ?? -1) < l) cells.set(key, l);
      };

      const mode = state === "speaking" ? "talk" : state === "listening" ? "listen" : state === "thinking" ? "think" : "rest";
      const v = mode === "talk" ? clamp(0.3 + shown * 0.9, 0, 1) : mode === "listen" ? clamp(0.35 + 0.3 * Math.abs(Math.sin(t * 4.1)), 0, 1)
        : mode === "think" ? 0.25 : 0.12 + 0.05 * Math.sin(t * 1.4);
      const spinRate = mode === "think" ? 1.6 : state === "muted" || state === "offline" ? 0.08 : 0.32;
      spin += spinRate * dt;
      const yaw = spin, pitch = -0.42, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const breath = 1 + (state === "waiting" ? 0.04 : 0.015) * Math.sin(t * (state === "waiting" ? 5 : 1.4));
      const wavy = mode === "talk" || mode === "listen" ? v : 0.12;
      for (const p of small ? DOTS.small : DOTS.big) {
        // ripples run over the surface: the voice raises them, bulging the points outward
        const band = Math.sin(p[1] * 7 - t * (mode === "talk" ? 9 : 3)) * 0.5 + Math.sin(Math.atan2(p[2], p[0]) * 5 + t * 4) * 0.5;
        const r = rad * breath * (1 + wavy * 0.16 * band);
        let x = p[0] * cyw + p[2] * syw, z = -p[0] * syw + p[2] * cyw;
        const y = p[1] * cp - z * sp;
        z = p[1] * sp + z * cp;
        const px = cx + x * r, py = cy + y * r;
        if (z < -0.15) { if (th(Math.floor(px), Math.floor(py)) < 0.5) put(px, py, 1); continue; }
        const lam = clamp(-x * 0.45 - y * 0.6 + z * 0.66, 0, 1);         // lit from the top left
        put(px, py, clamp(Math.round(1 + lam * 1.6 + Math.max(0, band) * wavy * 1.4 + (z > 0.7 ? 0.4 : 0)), 1, L - 1));
      }
      // the heart: a bright core that swells with the voice
      const hr = Math.max(1, Math.round(rad * (state === "muted" ? 0.1 : 0.17 + v * 0.07)));
      for (let y = -hr - 1; y <= hr + 1; y++) for (let x = -hr - 1; x <= hr + 1; x++) {
        const d = Math.hypot(x / (hr + 0.5), y / (hr + 0.5));
        if (d <= 1.35) put(Math.round(cx) + x, Math.round(cy) + y, d < 0.55 ? L : d < 1 ? L - 1 : 2);
      }
      // thinking: a short arc of light sweeping round the globe, like a HUD scan
      if (mode === "think") for (let i = 0; i < 10; i++) {
        const a = t * 3.2 - i * 0.07;
        put(cx + Math.cos(a) * (rad + 2), cy + Math.sin(a) * (rad + 2) * 0.96, i < 3 ? L : i < 6 ? L - 1 : 2);
      }

      // Each cell is 6x6 image pixels: a round dot with a dark gap round it.
      const K = 6;
      if (grid.width !== gw * K || grid.height !== gh * K) { grid.width = gw * K; grid.height = gh * K; }
      const img = gctx.createImageData(gw * K, gh * K), d = img.data, IW = gw * K;
      for (const [key, l] of cells) {
        const gx = key % gw, gy = (key - gx) / gw, c = pal[l];
        for (const [i, j] of DOT) {
          const o = ((gy * K + j) * IW + gx * K + i) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      gctx.putImageData(img, 0, 0);

      const W = canvas.width, H = canvas.height, DW = gw * P * dpr, DH = gh * P * dpr;
      const X = (W - DW) / 2, Y = (H - DH) / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(grid, X, Y, DW, DH);
      // bloom: the same picture, blurred, added on top
      if (bloom.width !== grid.width || bloom.height !== grid.height) { bloom.width = grid.width; bloom.height = grid.height; }
      bctx.clearRect(0, 0, bloom.width, bloom.height);
      bctx.filter = `blur(${K * 1.2}px)`;
      bctx.drawImage(grid, 0, 0);
      bctx.filter = "none";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55 + shown * 0.25;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bloom, X, Y, DW, DH);
      ctx.restore();
    },
  };
}

window.createLedOrb = createLedOrb;
})();
