/* ==================================================================
   scenes/solar.js — Solar System Explorer
   Sun + 8 planets, real relative orbital order and speed ratios,
   orbit lines, click-to-select with a live info panel.
   Visual scale is compressed (see SCALE_NOTE in data.js).
   ================================================================== */

const BASE_ORBIT = (Math.PI * 2) / 60; // Earth completes one orbit in ~60 s at 1× speed

class SolarSystemModule {
  constructor() {
    this.id = 'solar';
    this.home = { pos: new THREE.Vector3(0, 46, 108), target: new THREE.Vector3(0, 0, 0) };
    this.maxDist = 420;
    this.minDist = 10;
    this.group = null;
    this.planets = [];
    this.pickables = [];
    this.orbitLines = {};
    this.selectedLine = null;
    this.note = 'Planet sizes and orbit distances are compressed so all eight planets stay visible — this view is NOT to scale. Orbital order and relative orbital speeds are real. Click any body for real data.';
  }

  init(app) {
    this.app = app;
    const scene = app.scene;
    scene.background = new THREE.Color(0x02040c);

    this.group = new THREE.Group();
    scene.add(this.group);

    /* --- Sun --- */
    const sunMat = new THREE.MeshBasicMaterial({ map: createSunTexture() });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(6, 48, 48), sunMat);
    this.sun.userData.infoKey = 'sun';
    this.group.add(this.sun);
    this.pickables.push(this.sun);

    const glowTex = createGlowTexture('255,190,110');
    const glowA = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffc890, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glowA.scale.set(26, 26, 1);
    const glowB = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff9c50, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glowB.scale.set(52, 52, 1);
    this.group.add(glowA, glowB);

    this.group.add(new THREE.PointLight(0xffffff, 1.3, 0));
    this.group.add(new THREE.AmbientLight(0x30405a, 0.5));

    /* --- Planets --- */
    for (const p of PLANETS) this.createPlanet(p);
  }

  createPlanet(p) {
    const v = p.visual;

    const holder = new THREE.Group();
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(v.tilt || 0);
    holder.add(tiltGroup);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(v.radius, 40, 40),
      new THREE.MeshStandardMaterial({ map: createPlanetTexture(p.id), roughness: 0.95, metalness: 0 })
    );
    mesh.userData.infoKey = p.id;
    tiltGroup.add(mesh);

    if (p.id === 'saturn') tiltGroup.add(createRingMesh(v.radius, false));
    if (p.id === 'uranus') tiltGroup.add(createRingMesh(v.radius, true));

    // invisible pick proxy so small planets are easy to click/tap
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(v.radius * 1.9, 1.7), 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.userData.infoKey = p.id;
    holder.add(proxy);

    // orbit line
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * v.distance, 0, Math.sin(a) * v.distance));
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x2e4368, transparent: true, opacity: 0.55 })
    );
    this.group.add(orbitLine);

    this.group.add(holder);

    this.planets.push({ data: p, holder, mesh, proxy, orbitLine, angle: Math.random() * Math.PI * 2 });
    this.pickables.push(mesh, proxy);
    this.orbitLines[p.id] = orbitLine;

    // Earth's Moon
    if (p.id === 'earth') {
      this.moonPivot = new THREE.Group();
      this.moonPivot.rotation.x = THREE.MathUtils.degToRad(5);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(0.33, 24, 24),
        new THREE.MeshStandardMaterial({ map: createMoonTexture(), roughness: 1 })
      );
      moon.position.set(2.6, 0, 0);
      this.moonPivot.add(moon);
      holder.add(this.moonPivot);
    }
  }

  update(dt, dtReal) {
    this.sun.rotation.y += 0.02 * dtReal;
    for (const pl of this.planets) {
      pl.angle += BASE_ORBIT * pl.data.visual.orbitFactor * dt;
      const d = pl.data.visual.distance;
      pl.holder.position.set(Math.cos(pl.angle) * d, 0, Math.sin(pl.angle) * d);
      pl.mesh.rotation.y += pl.data.visual.spinSpeed * dt;
    }
    if (this.moonPivot) this.moonPivot.rotation.y += 0.55 * dt;
  }

  select(key) {
    this.deselect();
    const line = this.orbitLines[key];
    if (line) {
      line.material.color.set(0x6cc7ff);
      line.material.opacity = 0.95;
      this.selectedLine = line;
    }
    const pl = this.planets.find(x => x.data.id === key);
    if (pl && pl.mesh.material.emissive) pl.mesh.material.emissive.set(0x0d2a4a);
  }

  deselect() {
    if (this.selectedLine) {
      this.selectedLine.material.color.set(0x2e4368);
      this.selectedLine.material.opacity = 0.55;
      this.selectedLine = null;
    }
    for (const pl of this.planets) {
      if (pl.mesh.material.emissive) pl.mesh.material.emissive.set(0x000000);
    }
  }

  getFocus(key) {
    if (key === 'sun') return { object: this.sun, distance: 36 };
    const pl = this.planets.find(x => x.data.id === key);
    if (pl) return { object: pl.holder, distance: pl.data.visual.radius * 5 + 6 };
    return null;
  }

  dispose() {
    const scene = this.app.scene;
    scene.remove(this.group);
    disposeGroup(this.group);
    this.planets = [];
    this.pickables = [];
    this.orbitLines = {};
    this.selectedLine = null;
  }
}

/* Saturn/Uranus ring mesh with UVs remapped by radius so the band
   texture runs radially instead of across the bounding square. */
function createRingMesh(radius, thin) {
  const inner = radius * 1.35;
  const outer = radius * (thin ? 1.75 : 2.3);
  const geo = new THREE.RingGeometry(inner, outer, 160, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = (v.length() - inner) / (outer - inner);
    geo.attributes.uv.setXY(i, u, 0.5);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: createRingTexture(),
    transparent: true,
    opacity: thin ? 0.35 : 0.96,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
