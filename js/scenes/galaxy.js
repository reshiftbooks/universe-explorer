/* ==================================================================
   scenes/galaxy.js — Galaxy Explorer
   Procedural barred-spiral Milky Way built from ~22,000 star
   particles in 4 spiral arms with a bright core, plus wispy nebula
   sprites along the arms. Schematic — clearly labelled in-UI.
   ================================================================== */

class GalaxyModule {
  constructor() {
    this.id = 'galaxy';
    this.home = { pos: new THREE.Vector3(0, 30, 62), target: new THREE.Vector3(0, 0, 0) };
    this.maxDist = 260;
    this.minDist = 15;
    this.group = null;
    this.pickables = [];
    this.note = 'Schematic notice: ~22,000 star particles represent the Milky Way\u2019s 100–400 billion real stars. The 4-arm spiral structure and colour gradient (yellow-white core, blue arms) are scientifically informed but simplified.';
  }

  init(app) {
    this.app = app;
    const scene = app.scene;
    scene.background = new THREE.Color(0x010207);

    this.group = new THREE.Group();
    scene.add(this.group);

    const count = 22000;
    const radius = 55;
    const branches = 4;
    const spin = 1.35;
    const randomness = 0.28;
    const power = 2.6;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const insideColor = new THREE.Color(0xffe3b3);
    const outsideColor = new THREE.Color(0x4472e0);
    const mixed = new THREE.Color();
    const rand = mulberry32(2024);

    for (let i = 0; i < count; i++) {
      // denser towards the centre
      const r = Math.pow(rand(), 1.7) * radius;
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = r * spin;

      // scatter around the arm (thicker in the middle of the disk)
      const rx = Math.pow(rand(), power) * (rand() < 0.5 ? 1 : -1) * randomness * r;
      const ry = Math.pow(rand(), power) * (rand() < 0.5 ? 1 : -1) * randomness * r * 0.45;
      const rz = Math.pow(rand(), power) * (rand() < 0.5 ? 1 : -1) * randomness * r * 0.45;

      positions[i * 3] = Math.cos(branchAngle + spinAngle) * r + rx;
      positions[i * 3 + 1] = ry * 0.35;
      positions[i * 3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz;

      // yellow-white core -> blue outer arms, brighter at the centre
      const t = r / radius;
      mixed.copy(insideColor).lerp(outsideColor, t);
      const boost = 1.25 - t * 0.45;
      colors[i * 3] = Math.min(mixed.r * boost, 1);
      colors[i * 3 + 1] = Math.min(mixed.g * boost, 1);
      colors[i * 3 + 2] = Math.min(mixed.b * boost, 1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.32,
      map: createStarPointTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true
    });

    this.stars = new THREE.Points(geo, mat);
    this.group.add(this.stars);

    // bright core glow
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture('255,224,170'), color: 0xffe0aa, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    core.scale.set(16, 16, 1);
    this.group.add(core);

    // nebula clouds along the arms
    const nebulaColors = ['255,110,170', '90,176,255', '154,107,255'];
    const nebRand = mulberry32(77);
    for (let i = 0; i < 14; i++) {
      const r = 10 + nebRand() * 45;
      const a = nebRand() * Math.PI * 2;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createNebulaTexture(nebulaColors[i % nebulaColors.length], 10 + i),
        transparent: true, opacity: 0.10 + nebRand() * 0.06,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sprite.position.set(Math.cos(a) * r, (nebRand() - 0.5) * 2.5, Math.sin(a) * r);
      const s = 8 + nebRand() * 10;
      sprite.scale.set(s, s, 1);
      this.group.add(sprite);
    }

    app.showInfoPanel('galaxy');
  }

  update(dt) {
    this.group.rotation.y += 0.02 * dt;
  }

  select() { /* no selectable sub-objects */ }
  deselect() { /* nothing */ }
  getFocus() { return null; }

  dispose() {
    const scene = this.app.scene;
    scene.remove(this.group);
    disposeGroup(this.group);
    this.pickables = [];
  }
}
