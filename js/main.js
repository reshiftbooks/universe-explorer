/* ==================================================================
   main.js — UniverseApp controller
   ------------------------------------------------------------------
   Owns the renderer, camera, OrbitControls, module switching,
   raycast picking, the info panel, tooltips and all interactive
   controls (play/pause, speed, reset view, fullscreen).
   ================================================================== */

/* ---------- helpers ---------- */

function detectWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function disposeGroup(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function showError(msg) {
  const overlay = document.getElementById('error-overlay');
  const box = document.getElementById('error-message');
  const loader = document.getElementById('loader');
  if (box && msg) box.textContent = String(msg);
  if (overlay) overlay.hidden = false;
  if (loader) loader.classList.add('done');
}

/* ---------- normalized info-panel content ---------- */

function planetInfo(p) {
  return {
    title: p.name,
    subtitle: 'Planet — Solar System',
    stats: [
      ['Diameter', p.diameter],
      ['Mass', p.mass],
      ['Surface gravity', p.gravity],
      ['Mean temperature', p.temp],
      ['Distance from Sun', p.distance],
      ['Orbital period', p.orbit],
      ['Rotation period', p.rotation]
    ],
    listTitle: 'Atmosphere',
    listItems: p.atmosphere,
    facts: p.facts,
    note: SCALE_NOTE
  };
}

const INFO_SOURCES = {};

function registerInfoSources() {
  for (const p of PLANETS) {
    INFO_SOURCES[p.id] = (p.id === 'earth') ? EARTH_INFO : planetInfo(p);
  }
  INFO_SOURCES.sun = SUN_INFO;
  INFO_SOURCES.blackhole = BLACK_HOLE_INFO;
  INFO_SOURCES.galaxy = GALAXY_INFO;
}

function buildMissionsOverlay() {
  const grid = document.getElementById('missions-grid');
  grid.innerHTML = MISSIONS.map(m => (
    '<article class="mission-card">' +
      '<div class="m-top"><span class="m-tag">' + m.year + '</span>' +
      '<span class="m-status ' + m.statusClass + '">' + m.status + '</span></div>' +
      '<h3>' + m.name + '</h3>' +
      '<p class="m-agency">' + m.agency + '</p>' +
      '<p class="m-desc">' + m.description + '</p>' +
      '<ul class="m-facts">' + m.facts.map(f => '<li>' + f + '</li>').join('') + '</ul>' +
    '</article>'
  )).join('');
}

/* ---------- shared background starfield ---------- */

function createStarfield() {
  const group = new THREE.Group();
  const count = 2600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [
    [1, 1, 1], [1, 1, 1], [1, 1, 1],
    [0.75, 0.83, 1], [1, 0.91, 0.77], [1, 0.85, 0.85]
  ];
  const rand = mulberry32(31415);

  for (let i = 0; i < count; i++) {
    // random direction, radius 600..1400 (inside camera far plane)
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 600 + rand() * 800;
    positions[i * 3] = s * Math.cos(phi) * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = s * Math.sin(phi) * r;
    const c = palette[Math.floor(rand() * palette.length)];
    const dim = 0.5 + rand() * 0.5;
    colors[i * 3] = c[0] * dim;
    colors[i * 3 + 1] = c[1] * dim;
    colors[i * 3 + 2] = c[2] * dim;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    map: createStarPointTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    vertexColors: true
  });
  group.add(new THREE.Points(geo, mat));

  // a few faint background nebulae, visible in every module
  const nebulae = [
    { rgb: '90,120,255', seed: 21, pos: [-500, 150, -700], scale: 700 },
    { rgb: '170,90,255', seed: 22, pos: [600, -200, -600], scale: 650 },
    { rgb: '255,120,160', seed: 23, pos: [-200, 300, 700], scale: 600 }
  ];
  for (const n of nebulae) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createNebulaTexture(n.rgb, n.seed),
      transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.position.set(n.pos[0], n.pos[1], n.pos[2]);
    sprite.scale.set(n.scale, n.scale, 1);
    group.add(sprite);
  }
  return group;
}

/* ================= UniverseApp ================= */

class UniverseApp {
  constructor() {
    this.canvas = document.getElementById('scene');

    if (!detectWebGL()) {
      showError('Your browser does not support WebGL, which is required for the 3D views. Try a current version of Chrome, Firefox, Edge or Safari.');
      return;
    }

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(0, 46, 108);

    this.controls = new THREE.OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;

    this.starfield = createStarfield();
    this.scene.add(this.starfield);

    this.modules = {
      solar: new SolarSystemModule(),
      earth: new EarthModule(),
      blackhole: new BlackHoleModule(),
      galaxy: new GalaxyModule(),
      missions: new MissionsModule()
    };

    this.activeId = null;
    this.active = null;
    this.playing = true;
    this.speed = 1;
    this.selectedKey = null;
    this.focusTarget = null;
    this.focusDistance = 0;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDown = null;
    this.loaderHidden = false;

    registerInfoSources();
    this.bindUI();
    this.bindEvents();
    buildMissionsOverlay();
    this.setModule('solar');

    const app = this;
    (function loop() {
      requestAnimationFrame(loop);
      app.tick();
    })();
  }

  /* ---------- module switching ---------- */

  setModule(id) {
    const mod = this.modules[id];
    if (!mod || id === this.activeId) return;

    if (this.active) this.active.dispose();

    this.activeId = id;
    this.active = mod;
    this.clearSelection();
    this.focusTarget = null;

    try {
      mod.init(this);
    } catch (err) {
      showError('Failed to initialize module "' + id + '": ' + err.message);
      return;
    }

    // camera home
    this.camera.position.copy(mod.home.pos);
    this.controls.target.copy(mod.home.target);
    this.controls.minDistance = mod.minDist || 5;
    this.controls.maxDistance = mod.maxDist || 400;
    this.controls.update();

    // nav highlighting
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.module === id);
    });

    // scale note
    const noteEl = document.getElementById('scale-note');
    noteEl.textContent = mod.note || '';
    noteEl.hidden = !mod.note;
  }

  /* ---------- UI wiring ---------- */

  bindUI() {
    const $ = id => document.getElementById(id);

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setModule(btn.dataset.module));
    });

    $('btn-play').addEventListener('click', () => this.togglePlay());
    $('speed-slider').addEventListener('input', e => {
      this.speed = parseFloat(e.target.value);
      $('speed-value').textContent = this.speed.toFixed(1) + '\u00d7';
    });
    $('btn-reset').addEventListener('click', () => this.resetView());
    $('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
    $('info-close').addEventListener('click', () => this.clearSelection());
    $('error-reload').addEventListener('click', () => window.location.reload());

    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      $('btn-fullscreen').textContent = on ? 'Exit Fullscreen' : 'Fullscreen';
    });

    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
      else if (e.key === 'r' || e.key === 'R') this.resetView();
      else if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
      else if (e.key === 'Escape') this.clearSelection();
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  togglePlay() {
    this.playing = !this.playing;
    document.getElementById('btn-play-label').textContent = this.playing ? 'Pause' : 'Play';
  }

  resetView() {
    if (!this.active) return;
    this.focusTarget = null;
    this.camera.position.copy(this.active.home.pos);
    this.controls.target.copy(this.active.home.target);
    this.controls.update();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  showMissionsOverlay(show) {
    document.getElementById('missions-overlay').hidden = !show;
  }

  /* ---------- info panel ---------- */

  showInfoPanel(key) {
    const info = INFO_SOURCES[key];
    if (!info) return;
    this.selectedKey = key;

    const stats = info.stats.map(s => (
      '<div class="stat"><span class="stat-label">' + s[0] + '</span>' +
      '<span class="stat-value">' + s[1] + '</span></div>'
    )).join('');

    const list = info.listItems.map(li => '<li>' + li + '</li>').join('');
    const facts = info.facts.map(f => '<li>' + f + '</li>').join('');

    document.getElementById('info-content').innerHTML =
      '<h2 class="info-title">' + info.title + '</h2>' +
      '<p class="info-sub">' + info.subtitle + '</p>' +
      '<div class="stat-grid">' + stats + '</div>' +
      '<div class="info-list"><h4>' + info.listTitle + '</h4><ul>' + list + '</ul></div>' +
      '<div class="fact-box"><h4>Did you know?</h4><ul>' + facts + '</ul></div>' +
      '<div class="scale-box">' + info.note + '</div>';

    document.getElementById('info-panel').hidden = false;

    if (this.active && this.active.select) this.active.select(key);

    const f = this.active && this.active.getFocus ? this.active.getFocus(key) : null;
    if (f) this.focusOn(f.object, f.distance);
  }

  hideInfoPanel() {
    document.getElementById('info-panel').hidden = true;
  }

  clearSelection() {
    this.selectedKey = null;
    this.hideInfoPanel();
    if (this.active && this.active.deselect) this.active.deselect();
  }

  /* ---------- picking & tooltip ---------- */

  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('pointermove', e => {
      this.updatePointer(e);
      if (this.pointerDown) return; // dragging — no hover raycast
      const hit = this.raycast();
      const tooltip = document.getElementById('tooltip');
      if (hit) {
        const info = INFO_SOURCES[hit];
        tooltip.textContent = info ? info.title : hit;
        tooltip.hidden = false;
        tooltip.style.left = e.clientX + 'px';
        tooltip.style.top = e.clientY + 'px';
        canvas.style.cursor = 'pointer';
      } else {
        tooltip.hidden = true;
        canvas.style.cursor = '';
      }
    });

    canvas.addEventListener('pointerdown', e => {
      this.pointerDown = { x: e.clientX, y: e.clientY };
      this.focusTarget = null; // user takes over while animating focus
    });

    canvas.addEventListener('pointerup', e => {
      if (!this.pointerDown) return;
      const dx = e.clientX - this.pointerDown.x;
      const dy = e.clientY - this.pointerDown.y;
      this.pointerDown = null;
      if (dx * dx + dy * dy > 25) return; // it was a drag, not a click
      this.updatePointer(e);
      const hit = this.raycast();
      if (hit) this.showInfoPanel(hit);
    });

    canvas.addEventListener('pointerleave', () => {
      document.getElementById('tooltip').hidden = true;
    });
  }

  updatePointer(e) {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  raycast() {
    if (!this.active || !this.active.pickables.length) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.active.pickables, false);
    if (hits.length) {
      const key = hits[0].object.userData.infoKey;
      if (key) return key;
    }
    return null;
  }

  /* ---------- smooth camera focus ---------- */

  focusOn(object3d, distance) {
    this.focusTarget = object3d;
    this.focusDistance = distance;
  }

  updateFocus() {
    if (!this.focusTarget) return;
    const p = new THREE.Vector3();
    this.focusTarget.getWorldPosition(p);
    this.controls.target.lerp(p, 0.08);
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = dir.length();
    if (len < 0.001) dir.set(0, 0.5, 1);
    dir.normalize();
    const desired = p.clone().add(dir.multiplyScalar(this.focusDistance));
    this.camera.position.lerp(desired, 0.08);
    if (this.camera.position.distanceTo(desired) < 0.4) this.focusTarget = null;
  }

  /* ---------- main loop ---------- */

  tick() {
    const dtReal = Math.min(this.clock.getDelta(), 0.05);
    const dt = this.playing ? dtReal * this.speed : 0;

    if (this.active) this.active.update(dt, dtReal);
    this.controls.update();
    this.updateFocus();
    this.renderer.render(this.scene, this.camera);

    if (!this.loaderHidden) {
      this.loaderHidden = true;
      document.getElementById('loader').classList.add('done');
    }
  }
}

/* ---------- boot ---------- */

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new UniverseApp();
  } catch (err) {
    showError(err && err.message ? err.message : 'Unknown initialization error.');
  }
});

window.addEventListener('error', e => {
  // only surface errors as a visible overlay before/while the app boots,
  // so a CDN hiccup is explained instead of a silent blank page
  if (!window.app || !window.app.loaderHidden) {
    showError(e.message || 'Unexpected error while loading.');
  }
});
