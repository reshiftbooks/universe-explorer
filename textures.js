/* ==================================================================
   textures.js — Procedural canvas textures
   ------------------------------------------------------------------
   Every planet, moon, ring, cloud layer, glow and nebula is generated
   at runtime with seeded value-noise — no external image files, so the
   app works offline after Three.js is cached and never hits a 404.
   ================================================================== */

/* ---------- small math helpers ---------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function smoothstep(a, b, t) {
  t = clamp01((t - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Seeded periodic value-noise / fBm.
   Horizontal wrap is seamless because grid indices wrap at 256 and all
   x frequencies used below are integers. */
function makeNoise(seed) {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();

  function at(ix, iy) {
    ix = ((ix % SIZE) + SIZE) % SIZE;
    iy = ((iy % SIZE) + SIZE) % SIZE;
    return grid[iy * SIZE + ix];
  }
  function noise2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  return function fbm(x, y, octaves) {
    let v = 0, amp = 0.5, freq = 1;
    for (let o = 0; o < octaves; o++) {
      v += amp * noise2(x * freq, y * freq);
      amp *= 0.5; freq *= 2;
    }
    return v;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/* ---------- rocky planets & moons ---------- */

function createRockyTexture(opts) {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(opts.seed || 7);
  const base = opts.base || [120, 110, 100];
  const dark = opts.dark || [60, 55, 50];
  const light = opts.light || [180, 170, 155];
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 128;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 256;
      const n = fbm(nx, ny, 5);
      const m = fbm(nx * 2 + 37, ny * 2 + 11, 3);
      const t = clamp01(n * 0.75 + m * 0.25);
      let c0, c1, t2;
      if (t < 0.55) { c0 = dark; c1 = base; t2 = t / 0.55; }
      else { c0 = base; c1 = light; t2 = (t - 0.55) / 0.45; }
      const i = (y * W + x) * 4;
      data[i] = c0[0] + (c1[0] - c0[0]) * t2;
      data[i + 1] = c0[1] + (c1[1] - c0[1]) * t2;
      data[i + 2] = c0[2] + (c1[2] - c0[2]) * t2;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // craters (avoid the wrap seam near the edges)
  if (opts.craters) {
    const rand = mulberry32((opts.seed || 7) * 7 + 3);
    for (let i = 0; i < opts.craters; i++) {
      const cx = 16 + rand() * (W - 32);
      const cy = 16 + rand() * (H - 32);
      const r = 1.5 + Math.pow(rand(), 2.2) * 12;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.stroke();
    }
  }

  // dark volcanic maria (for the Moon)
  if (opts.maria) {
    const rand = mulberry32((opts.seed || 7) * 13 + 5);
    for (let i = 0; i < 7; i++) {
      const cx = 30 + rand() * (W - 60);
      const cy = 40 + rand() * (H - 80);
      const r = 22 + rand() * 38;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.6, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(38,38,48,0.35)';
      ctx.fill();
    }
  }

  // polar ice caps
  if (opts.polarCaps) {
    const capH = H * 0.09;
    for (let y = 0; y < capH; y++) {
      const t = y / capH;
      ctx.fillStyle = 'rgba(240,244,248,' + ((1 - t) * 0.85).toFixed(3) + ')';
      ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = 'rgba(240,244,248,' + ((1 - t) * 0.85).toFixed(3) + ')';
      ctx.fillRect(0, H - 1 - y, W, 1);
    }
  }

  return toTexture(canvas);
}

/* ---------- gas giants & banded planets ---------- */

function createGasTexture(opts) {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(opts.seed || 7);
  const colors = opts.bands.map(hexToRgb);
  const stops = colors.length - 1;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 128;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 256;
      // stretched turbulence: bands wobble without breaking the seam
      const turb = (fbm(nx, ny * 6, 3) - 0.5) * (opts.turbulence || 8);
      let yy = y + turb;
      yy = yy < 0 ? 0 : yy > H - 1 ? H - 1 : yy;
      const t = (yy / H) * stops;
      const i0 = Math.min(Math.floor(t), stops - 1);
      const f = t - i0;
      const c0 = colors[i0], c1 = colors[i0 + 1];
      const grain = (fbm(nx * 2 + 91, ny * 8 + 17, 2) - 0.5) * 14;
      const i = (y * W + x) * 4;
      data[i] = c0[0] + (c1[0] - c0[0]) * f + grain;
      data[i + 1] = c0[1] + (c1[1] - c0[1]) * f + grain * 0.9;
      data[i + 2] = c0[2] + (c1[2] - c0[2]) * f + grain * 0.8;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // signature storm (Great Red Spot / Neptune dark spot)
  if (opts.spot) {
    const s = opts.spot;
    ctx.save();
    ctx.translate(s.x * W, s.y * H);
    ctx.beginPath();
    ctx.ellipse(0, 0, s.rx * W, s.ry * H, 0, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s.rx * W * 0.15, 0, s.rx * W * 0.55, s.ry * H * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d8906a';
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.restore();
  }

  return toTexture(canvas);
}

/* ---------- Earth: oceans, continents, ice caps ---------- */

function createEarthTexture() {
  const W = 1024, H = 512;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(42);
  const fbm2 = makeNoise(99);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 32;                          // quarter frequency -> continent-scale landmasses
    const lat = Math.abs((y / H) * 2 - 1);           // 0 equator → 1 poles
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 64;                       // quarter frequency, still seamless
      const e = fbm(nx, ny, 4);                      // elevation
      const detail = fbm2(nx * 4, ny * 4, 2);
      const iceEdge = 0.86 + (fbm2(nx, ny, 2) - 0.5) * 0.1;
      let r, g, b;
      if (lat > iceEdge) {                           // polar ice
        r = 225; g = 234; b = 242;
      } else if (e > 0.53) {                         // land
        const t = Math.min((e - 0.53) / 0.22, 1);
        r = 38 + 85 * t; g = 102 + 38 * t; b = 34 + 22 * t;
        if (t > 0.8) {                               // high "mountains"
          const k = (t - 0.8) / 0.2;
          r += 60 * k; g += 60 * k; b += 55 * k;
        }
        const dv = (detail - 0.5) * 16;
        r += dv; g += dv; b += dv;
      } else if (e > 0.50) {                         // shallow water
        const t = (e - 0.50) / 0.03;
        r = 26 + 20 * (1 - t); g = 88 + 30 * (1 - t); b = 130 + 25 * (1 - t);
      } else {                                       // deep ocean
        const d = Math.min((0.50 - e) / 0.5, 1);
        r = 6 + 14 * (1 - d); g = 28 + 38 * (1 - d); b = 66 + 52 * (1 - d);
      }
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/* ---------- Earth cloud layer ---------- */

function createCloudTexture() {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(7);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 64;                          // stretched, softer cloud fronts
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 256;
      const a = fbm(nx, ny, 3);
      const alpha = clamp01((a - 0.48) / 0.24) * 0.8;
      const i = (y * W + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
      data[i + 3] = alpha * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/* ---------- the Sun ---------- */

function createSunTexture() {
  const W = 512, H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(17);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 128;
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 256;
      const v = fbm(nx, ny, 4);
      const g = fbm(nx * 4, ny * 4, 2);
      const t = clamp01(v * 0.75 + g * 0.35 - 0.05);
      let r = 255;
      let gg = 120 + 130 * t;
      let b = 10 + 110 * t;
      if (g > 0.78) { gg = 240; b = 190; }           // bright granulation cells
      if (t < 0.3) { gg = 90; b = 5; }               // darker "spots"
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = gg; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/* ---------- planetary body dispatch ---------- */

const PLANET_TEXTURE_BUILDERS = {
  mercury: () => createRockyTexture({ seed: 11, base: [142, 130, 115], dark: [70, 62, 54], light: [190, 178, 160], craters: 90 }),
  venus:   () => createGasTexture({ seed: 21, turbulence: 10, bands: ['#e8cf9e', '#d3b276', '#f0dfb4', '#c9a763', '#e4c58f', '#bfa061'] }),
  earth:   () => createEarthTexture(),
  mars:    () => createRockyTexture({ seed: 31, base: [176, 92, 52], dark: [96, 44, 26], light: [220, 150, 96], craters: 45, polarCaps: true }),
  jupiter: () => createGasTexture({
    seed: 41, turbulence: 14,
    bands: ['#c8a06a', '#a9754c', '#e8d3b0', '#b98a5e', '#d9b98a', '#8a5a3a', '#e6d0a8', '#a5714a', '#caa271', '#96714e'],
    spot: { x: 0.68, y: 0.64, rx: 0.075, ry: 0.05, color: '#b0563a' }
  }),
  saturn:  () => createGasTexture({ seed: 51, turbulence: 7, bands: ['#d8c294', '#c4ad7f', '#e2d2a8', '#cdb887', '#d5c092', '#bfa578', '#dcc89c'] }),
  uranus:  () => createGasTexture({ seed: 61, turbulence: 3, bands: ['#a9dde2', '#93d0d7', '#b8e6ea', '#9bd5db', '#a4dade'] }),
  neptune: () => createGasTexture({
    seed: 71, turbulence: 9,
    bands: ['#3e6db2', '#33619f', '#4a7cc2', '#2c5494', '#4578b8', '#3a67a8'],
    spot: { x: 0.3, y: 0.42, rx: 0.06, ry: 0.035, color: '#20477e' }
  })
};

function createPlanetTexture(id) {
  const builder = PLANET_TEXTURE_BUILDERS[id];
  return builder ? builder() : createRockyTexture({});
}

function createMoonTexture() {
  return createRockyTexture({ seed: 81, base: [128, 128, 126], dark: [70, 70, 72], light: [180, 180, 178], craters: 120, maria: true });
}

/* ---------- rings (Saturn / Uranus) ---------- */

function createRingTexture() {
  const W = 1024, H = 64;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(101);
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let x = 0; x < W; x++) {
    const t = x / W;
    const env = smoothstep(0, 0.06, t) * (1 - smoothstep(0.94, 1, t));
    let a = clamp01(fbm(t * 90, 0.5, 3) * 1.5) * env;
    if (t > 0.55 && t < 0.63) a *= 0.15;             // Cassini division
    if (t > 0.30 && t < 0.335) a *= 0.45;            // inner gap
    const shade = 0.75 + fbm(t * 200, 3.5, 2) * 0.5;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      data[i] = 205 * shade; data[i + 1] = 185 * shade; data[i + 2] = 150 * shade;
      data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/* ---------- glows, stars & nebulae ---------- */

function createGlowTexture(rgb) {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(' + rgb + ',0.8)');
  g.addColorStop(0.25, 'rgba(' + rgb + ',0.35)');
  g.addColorStop(0.6, 'rgba(' + rgb + ',0.08)');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function createGlowRingTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(0.62, 'rgba(255,240,210,0.9)');
  g.addColorStop(0.68, 'rgba(255,200,140,0.55)');
  g.addColorStop(0.78, 'rgba(255,170,90,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function createStarPointTexture() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createNebulaTexture(rgb, seed) {
  const S = 256;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const fbm = makeNoise(seed || 5);
  const img = ctx.createImageData(S, S);
  const data = img.data;
  const parts = rgb.split(',').map(Number);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = 1 - clamp01(dist);
      const n = fbm((x / S) * 256, (y / S) * 256, 4);
      const a = clamp01((n - 0.35) * 1.6) * falloff * falloff;
      const i = (y * S + x) * 4;
      data[i] = parts[0]; data[i + 1] = parts[1]; data[i + 2] = parts[2];
      data[i + 3] = a * 230;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}
