/* ==================================================================
   scenes/earth.js — Earth Explorer
   Interactive 3D Earth with procedural continents/oceans, animated
   cloud layer, atmospheric rim glow, rotating day/night light and an
   orbiting Moon. Axial tilt of 23.5° is real.
   ================================================================== */

class EarthModule {
  constructor() {
    this.id = 'earth';
    this.home = { pos: new THREE.Vector3(10, 6, 19), target: new THREE.Vector3(0, 0, 0) };
    this.maxDist = 90;
    this.minDist = 7;
    this.group = null;
    this.pickables = [];
    this.note = 'The Earth texture here is procedurally generated; the day/night cycle, clouds and Moon orbit are illustrative. The 23.5° axial tilt and the relative Moon distance are real. Click Earth for real data.';
  }

  init(app) {
    this.app = app;
    const scene = app.scene;
    scene.background = new THREE.Color(0x02040c);

    this.group = new THREE.Group();
    scene.add(this.group);

    const R = 5;

    // tilted Earth (real 23.5° axial tilt)
    this.earthGroup = new THREE.Group();
    this.earthGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
    this.group.add(this.earthGroup);

    // surface
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 64),
      new THREE.MeshStandardMaterial({ map: createEarthTexture(), roughness: 0.9, metalness: 0 })
    );
    this.earth.userData.infoKey = 'earth';
    this.earthGroup.add(this.earth);
    this.pickables = [this.earth];

    // cloud layer, slightly larger and independently rotating
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.02, 48, 48),
      new THREE.MeshStandardMaterial({
        map: createCloudTexture(), transparent: true, opacity: 0.55, depthWrite: false
      })
    );
    this.earthGroup.add(this.clouds);

    // atmospheric rim glow (fresnel shader, back-side additive)
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x5aa9ff) } },
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
        '  vNormal = normalize(normalMatrix * normal);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'varying vec3 vNormal;',
        'void main() {',
        '  float d = clamp(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);',
        '  float intensity = pow(d, 4.0);',
        '  gl_FragColor = vec4(uColor, 1.0) * intensity * 1.4;',
        '}'
      ].join('\n'),
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 48, 48), atmoMat));

    // Moon
    this.moonPivot = new THREE.Group();
    this.moonPivot.rotation.x = THREE.MathUtils.degToRad(5);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.36, 32, 32),
      new THREE.MeshStandardMaterial({ map: createMoonTexture(), roughness: 1 })
    );
    moon.position.set(15, 0, 0);
    this.moonPivot.add(moon);
    this.group.add(this.moonPivot);

    // moving sunlight creates the day/night terminator
    this.sunLight = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.group.add(this.sunLight);
    this.group.add(new THREE.AmbientLight(0x1c2438, 0.9));

    this.elapsed = 0;
    app.showInfoPanel('earth');
  }

  update(dt, dtReal) {
    this.elapsed += dtReal;
    this.earth.rotation.y += 0.22 * dt;       // day cycle
    this.clouds.rotation.y += 0.26 * dt;      // clouds drift a little faster
    this.moonPivot.rotation.y += 0.035 * dt;  // 27.3-day orbit, sped up for visibility
    const a = this.elapsed * 0.05;
    this.sunLight.position.set(Math.cos(a) * 40, 8, Math.sin(a) * 40);
  }

  select() { /* single body — nothing extra to highlight */ }
  deselect() { /* nothing */ }

  getFocus() {
    return { object: this.earth, distance: 18 };
  }

  dispose() {
    const scene = this.app.scene;
    scene.remove(this.group);
    disposeGroup(this.group);
    this.pickables = [];
  }
}
