/* ==================================================================
   scenes/missions.js — Space Missions
   Educational overlay module: a scrollable card grid (Apollo, Voyager
   1 & 2, Hubble, JWST, Mars 2020) over a slowly drifting starfield.
   ================================================================== */

class MissionsModule {
  constructor() {
    this.id = 'missions';
    this.home = { pos: new THREE.Vector3(0, 4, 90), target: new THREE.Vector3(0, 0, 0) };
    this.maxDist = 200;
    this.minDist = 20;
    this.group = null;
    this.pickables = [];
    this.note = '';
  }

  init(app) {
    this.app = app;
    const scene = app.scene;
    scene.background = new THREE.Color(0x010207);
    this.group = new THREE.Group();
    scene.add(this.group);
    app.showMissionsOverlay(true);
    app.hideInfoPanel();
  }

  update(dtReal) {
    if (this.app.starfield) this.app.starfield.rotation.y += 0.005 * dtReal;
  }

  select() { /* none */ }
  deselect() { /* none */ }
  getFocus() { return null; }

  dispose() {
    this.app.showMissionsOverlay(false);
    const scene = this.app.scene;
    scene.remove(this.group);
    disposeGroup(this.group);
  }
}
