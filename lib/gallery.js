// The gallery: four framed specimens, each a live species in its own scene, drawn by the main
// renderer into the screen rectangle of its frame's window (scissor + viewport), after the main
// scene and before the shared bloom. Frames off screen are skipped. A swap rebuilds a frame from
// another config; meshes never move between scenes.
import * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { damp, rand, seeded, withRandom } from './kit.js';
import { createParticles } from './particles.js';

export function createGallery({ sim, U, device, envTex, recipes, getDpr }) {
  const cells = [];
  const empty = new THREE.Scene();

  function addCell(windowEl, frameEl, config, seed) {
    const rng = seeded(seed);
    const scene = new THREE.Scene();
    const ROOM = 0x05090c;
    scene.background = new THREE.Color(ROOM); scene.fog = new THREE.FogExp2(ROOM, 0.05);
    scene.environment = envTex;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x0d1114, roughness: 0.88, envMapIntensity: 0.06 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.35; floor.receiveShadow = true; scene.add(floor);
    const spot = new THREE.SpotLight(0xfff1de, 150, 0, 0.34, 0.85, 2);
    spot.position.set(0.6, 7.6, 1.1); spot.target.position.set(0, -2.35, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(512, 512); spot.shadow.camera.near = 3; spot.shadow.camera.far = 14;
    spot.shadow.bias = -0.0003; spot.shadow.normalBias = 0.02;
    scene.add(spot, spot.target);
    const rim = new THREE.DirectionalLight(0x86bfff, 1.9); rim.position.set(-4.5, 2.5, -5); scene.add(rim);
    const key = new THREE.DirectionalLight(0xffd6ae, 0.5); key.position.set(4, 1.2, 4.5); scene.add(key);
    scene.add(new THREE.HemisphereLight(0x1b2638, 0x050506, 0.35));
    const coreLight = new THREE.PointLight(0xffa35c, 3, 0, 2); scene.add(coreLight);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    const T = { open: 0, flash: 0, spin: 0, slow: 1, tilt: 0, dock: 0, warm: 0, tease: 0, petals: Array.from({ length: 5 }, () => ({ v: 0 })) };
    const ctx = { scene, spot, coreLight, U, sim, device, T, dock: { scale: 0.42, ndcY: 0.5 } };
    const input = { x: 0, y: 0, px: 0, py: 0, inside: false, lastMove: -100, flickX: 0, flickY: 0, fieldReset: true, engage: 0.2, hover: 0, hit: false };
    const cell = { windowEl, frameEl, scene, camera, T, ctx, input, rng, config: null, art: null, particles: null, rect: null, onScreen: false, squash: 0, hideArt: false, nextTwitch: 0 };
    withRandom(rng, () => {
      cell.particles = createParticles({ scene, palette: config.particles, U, sim, device, counts: { motes: 260, dust: 0, sparks: 140 } });
      cell.nextTwitch = sim.clock + rand(8, 18);
    });
    setSpecies(cell, config);
    cells.push(cell);
    return cell;
  }

  function setSpecies(cell, config) {
    withRandom(cell.rng, () => {
      if (cell.art) cell.art.dispose();
      cell.art = recipes[config.recipe](config, cell.ctx);
      cell.config = config;
      cell.particles.setPalette(config.particles);
    });
  }

  // the frame window's rectangle in CSS pixels; `live` = the page is open and the window is on screen
  function measure(live) {
    for (const c of cells) {
      c.rect = c.windowEl.getBoundingClientRect();
      c.onScreen = live && c.rect.bottom > 0 && c.rect.top < innerHeight && c.rect.width > 2;
    }
  }

  // each frame sees the cursor in its own viewport coordinates
  function updateInput(c, main, dt) {
    const r = c.rect, inp = c.input;
    const inside = main.inside && main.px >= r.left && main.px <= r.right && main.py >= r.top && main.py <= r.bottom;
    if (inside) {
      const nx = (main.px - r.left) / r.width * 2 - 1, ny = -((main.py - r.top) / r.height * 2 - 1);
      if (!inp.inside) inp.fieldReset = true; else { inp.flickX += nx - inp.x; inp.flickY += ny - inp.y; }
      if (nx !== inp.x || ny !== inp.y) inp.lastMove = sim.clock;
      inp.x = nx; inp.y = ny;
      c.frameEl.style.setProperty('--sx', ((nx + 1) / 2 * 100).toFixed(1) + '%');
    }
    inp.inside = inside;
    const engT = inside ? (sim.clock - inp.lastMove < 1.3 ? 1 : 0.3) : 0.2;
    inp.engage = damp(inp.engage, engT, engT > inp.engage ? 3.5 : 0.45, dt);
    inp.hit = inside && Math.hypot(inp.x * r.width / r.height, inp.y) < 0.75;
    inp.hover = damp(inp.hover, inp.hit ? 1 : 0, inp.hit ? 4 : 1.8, dt);
  }

  function update(dt, mainInput) {
    for (const c of cells) {
      if (!c.onScreen) continue;
      withRandom(c.rng, () => {
        const aspect = c.rect.width / c.rect.height, half = Math.tan(THREE.MathUtils.degToRad(15));
        const R = c.config.geometry.frame || 1.75;
        c.camera.aspect = aspect; c.camera.updateProjectionMatrix();
        updateInput(c, mainInput, dt);
        c.camera.position.set(c.input.x * 0.25 * c.input.engage, 0.3 + c.input.y * 0.35 * c.input.engage, Math.max(R / half, R / (half * aspect)) * 1.08);
        c.camera.lookAt(0, -0.05, 0);
        if (!device.reduced && sim.clock > c.nextTwitch) {
          c.nextTwitch = sim.clock + rand(8, 18);
          const b = c.art.surprise(); if (b) c.particles.F.burst = b;
        }
        const art = c.art;
        art.advance();
        art.updateMotion(dt, c.input, c.camera);
        if (c.squash > 0) art.floatRig.scale.multiplyScalar(Math.max(0.001, 1 - c.squash));
        art.updateParts(dt, c.input, c.camera);
        art.updateGlow(c.camera, c.input);
        art.updateEffects(dt, c.camera);
        c.particles.update(dt, c.input, c.camera, art);
        c.particles.syncUniforms(c.camera, art, c.rect.height * getDpr());
        art.setVisible(!c.hideArt);
      });
    }
  }

  // Draws every visible frame into its window, on top of the main scene, in the composer's read buffer.
  class FramesPass extends Pass {
    constructor() { super(); this.needsSwap = false; }
    render(r, writeBuffer, readBuffer) {
      // a frame whose piece is in flight is not drawn: its window shows the main scene, where the pieces fly
      const visible = cells.filter(c => c.onScreen && !c.hideArt);
      if (!visible.length) return;
      const dpr = getDpr(), rt = readBuffer, autoClear = r.autoClear;
      r.autoClear = true;
      for (const c of visible) {
        const b = c.rect;
        const x = Math.round(b.left * dpr), y = Math.round((innerHeight - b.bottom) * dpr), w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
        rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); rt.scissorTest = true;
        r.setRenderTarget(rt);
        r.render(c.scene, c.camera);
      }
      // Reset to the full target and render nothing: three.js resolves a multisampled target at the end
      // of each render(), and the last resolve must cover the whole target, not just the last frame's
      // rectangle, or the areas outside keep stale pixels.
      rt.viewport.set(0, 0, rt.width, rt.height); rt.scissorTest = false;
      r.setRenderTarget(rt);
      r.autoClear = false;
      r.render(empty, visible[0].camera);
      r.autoClear = autoClear;
    }
  }

  return { cells, addCell, setSpecies, measure, update, pass: new FramesPass() };
}
