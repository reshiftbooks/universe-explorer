/* ==================================================================
   scenes/blackhole.js — Black Hole Explorer
   Stylized interactive visualization:
   - event horizon (pure black sphere)
   - glowing photon ring (billboard sprite)
   - accretion disk rendered with a custom GLSL shader:
     differential rotation, turbulent streaks, temperature gradient
     and Doppler-style asymmetry.
   Clearly labelled as an artistic simulation (see BLACK_HOLE_INFO).
   ================================================================== */

class BlackHoleModule {
  constructor() {
    this.id = 'blackhole';
    this.home = { pos: new THREE.Vector3(0, 7.5, 26), target: new THREE.Vector3(0, 0.5, 0) };
    this.maxDist = 150;
    this.minDist = 6;
    this.group = null;
    this.pickables = [];
    this.note = 'Simulation notice: this is a stylized, education-focused visualization of a black hole — the disk, colours and lensing glow are artistic, not a ray-traced physical model. Click the black hole for the real physics.';
  }

  init(app) {
    this.app = app;
    const scene = app.scene;
    scene.background = new THREE.Color(0x010208);

    this.group = new THREE.Group();
    scene.add(this.group);

    // tilted disk plane group
    this.diskGroup = new THREE.Group();
    this.diskGroup.rotation.x = 0.42;
    this.diskGroup.rotation.y = -0.2;
    this.group.add(this.diskGroup);

    // event horizon — nothing darker than this
    this.blackSphere = new THREE.Mesh(
      new THREE.SphereGeometry(2, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    this.blackSphere.userData.infoKey = 'blackhole';
    this.group.add(this.blackSphere);
    this.pickables = [this.blackSphere];

    // pick proxy for easier clicking
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.userData.infoKey = 'blackhole';
    this.group.add(proxy);
    this.pickables.push(proxy);

    // photon ring — light orbiting just outside the horizon
    const photon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowRingTexture(), color: 0xffe6c0, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    photon.scale.set(5.4, 5.4, 1);
    this.group.add(photon);

    // accretion disk
    this.diskMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: [
        'varying float vR;',
        'varying float vAng;',
        'void main() {',
        '  float r = length(position.xy);',
        '  vR = (r - 2.7) / 5.3;',
        '  vAng = atan(position.y, position.x);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'varying float vR;',
        'varying float vAng;',

        'float hash(float n) { return fract(sin(n) * 43758.5453123); }',
        'float noise(float x) {',
        '  float i = floor(x); float f = fract(x);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  return mix(hash(i), hash(i + 1.0), f);',
        '}',

        'void main() {',
        '  float r = clamp(vR, 0.0, 1.0);',
        // differential rotation: inner material swirls faster
        '  float ang = vAng + uTime * (2.2 - r * 1.6);',
        // turbulent streaks
        '  float streak = noise(ang * 3.0 + r * 24.0) * 0.55 + noise(ang * 9.0 - r * 40.0) * 0.35;',
        // hot inner edge
        '  float bright = (1.0 - r) * 0.85 + 0.35;',
        '  bright *= 0.55 + streak * 0.9;',
        // Doppler-style asymmetry: approaching side is brighter
        '  bright *= 1.0 + 0.75 * sin(vAng);',
        // temperature gradient: white-yellow inner -> deep orange outer
        '  vec3 inner = vec3(1.0, 0.97, 0.88);',
        '  vec3 mid   = vec3(1.0, 0.60, 0.18);',
        '  vec3 outer = vec3(0.52, 0.15, 0.04);',
        '  vec3 col = mix(inner, mid, smoothstep(0.0, 0.4, r));',
        '  col = mix(col, outer, smoothstep(0.4, 1.0, r));',
        // soft edges
        '  float alpha = smoothstep(0.0, 0.10, r) * (1.0 - smoothstep(0.72, 1.0, r));',
        '  gl_FragColor = vec4(col * bright, alpha * 0.85);',
        '}'
      ].join('\n'),
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(2.7, 8, 160, 4), this.diskMat);
    disk.rotation.x = -Math.PI / 2;
    this.diskGroup.add(disk);

    // warm inner glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture('255,150,60'), color: 0xffa050, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(8, 8, 1);
    this.diskGroup.add(glow);

    app.showInfoPanel('blackhole');
  }

  update(dt) {
    this.diskMat.uniforms.uTime.value += dt;
    this.blackSphere.rotation.y += 0.05;
  }

  select() { /* nothing extra to highlight */ }
  deselect() { /* nothing */ }

  getFocus() {
    return { object: this.blackSphere, distance: 16 };
  }

  dispose() {
    const scene = this.app.scene;
    scene.remove(this.group);
    disposeGroup(this.group);
    this.pickables = [];
  }
}
