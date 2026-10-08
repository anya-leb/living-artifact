// The shared body every gallery species is built on: rigs, the cursor-following motion,
// the glowing core, its billboards and the transition events. A species adds its own parts
// to the rigs and supplies updateParts(); finish() returns the interface the stage drives.
// (Prime predates this and keeps its own inline copy.)
//
// Rig hierarchy: floatRig (bob + drift + dock) > leanRig (tilt) > spinRig (yaw) > breathRig (scale)
import * as THREE from 'three';
import { clamp, lerp, smooth, damp, rand, easeOutCubic, noise1, spring, stepSpring, color } from './kit.js';
import { coreMaterial, glowMaterial, shockMaterial } from './materials.js';

export function createBody(config, ctx) {
  const { scene, coreLight, U, sim, device, T, dock } = ctx;
  const C = config.palette, G = config.geometry, MO = config.motion, HV = config.hover, BL = config.bloom;
  const added = [];
  const add = (o) => { scene.add(o); added.push(o); return o; };
  coreLight.color.set(C.coreLight);

  const floatRig = add(new THREE.Group());
  const leanRig = new THREE.Group(); floatRig.add(leanRig);
  const spinRig = new THREE.Group(); leanRig.add(spinRig);
  const breathRig = new THREE.Group(); spinRig.add(breathRig);
  if (G.offsetY) breathRig.position.y = G.offsetY;      // re-centre tall or hanging silhouettes

  // every species has a glowing heart
  const coreMat = coreMaterial(C, U);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), coreMat);
  core.scale.setScalar(G.core); breathRig.add(core);
  if (G.coreY) core.position.y = G.coreY;

  const coreGlow = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial(color(THREE, C.coreGlow), 5.0)));
  coreGlow.renderOrder = 10;
  const halo = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial(color(THREE, C.halo), 3.0, true)));
  halo.scale.setScalar(10);
  const shock = add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shockMaterial(color(THREE, C.shock))));
  shock.scale.setScalar(BL.shockScale); shock.visible = false; shock.renderOrder = 11;

  const rotY = spring(), rotX = spring(), leanX = spring(), leanZ = spring(), shX = spring(), shY = spring();
  let prox = 0, freeV = 0, freeA = 0, autoA = 0, shockT = -1;
  const fx = { shiver: 0, kick: 0, pulse: 0, sway: 0 };   // surprise impulses the species can react to
  const tmpV = new THREE.Vector3(), coreW = new THREE.Vector3(), camDir = new THREE.Vector3(), dockW = new THREE.Vector3();
  const view = { open: 0, br: 0, intro: 0, heat: 0, pulse: 0, T };

  function advance() { view.open = Math.max(0, T.open); }

  function surprise() {
    const sgn = Math.random() < 0.5 ? -1 : 1;
    let burst = 0;
    switch (Math.floor(Math.random() * 5)) {
      case 0: rotY.v += sgn * rand(1.4, 2.4); leanX.v += rand(-0.6, 0.6); break;   // a glance
      case 1: fx.shiver = 1; break;                                                 // a flutter
      case 2: fx.pulse = 1; burst = 0.7; break;                                      // a heartbeat
      case 3: fx.kick = sgn * 2.6; break;                                            // parts realign
      case 4: fx.sway = sgn; break;                                                  // something swings
    }
    return burst;
  }

  function updateMotion(dt, input, camera) {
    const { simT, sdt } = sim, hover = input.hover, engage = input.engage;
    fx.shiver *= Math.exp(-2.2 * dt); fx.kick *= Math.exp(-1.2 * dt); fx.pulse *= Math.exp(-2.5 * dt); fx.sway *= Math.exp(-1.5 * dt);

    camera.updateMatrixWorld();
    floatRig.getWorldPosition(tmpV); tmpV.project(camera);
    if (!Number.isFinite(tmpV.x) || !Number.isFinite(tmpV.y)) tmpV.set(0, 0, 0);
    const ldx = (input.x - tmpV.x) * camera.aspect, ldy = input.y - tmpV.y, ld = Math.hypot(ldx, ldy) + 1e-4;
    prox = damp(prox, input.inside ? (1 - smooth(0.3, 1.35, ld)) : 0, 3, dt);
    const leanAmt = prox * smooth(0.04, 0.35, ld), nx = ldx / ld, ny = ldy / ld;

    stepSpring(rotY, input.x * MO.turn.yaw * engage, 16, 4.2, dt);
    stepSpring(rotX, input.y * MO.turn.pitch * engage, 16, 4.6, dt);
    stepSpring(leanZ, -nx * MO.lean.roll * leanAmt, 22, 5.5, dt);
    stepSpring(leanX, -ny * MO.lean.pitch * leanAmt, 22, 5.5, dt);
    stepSpring(shX, nx * MO.lean.shiftX * leanAmt, 14, 5, dt);
    stepSpring(shY, ny * MO.lean.shiftY * leanAmt, 14, 5, dt);
    freeV += input.flickX * (device.reduced ? 0.25 : 0.75); rotX.v += input.flickY * 1.1; input.flickX = input.flickY = 0;
    freeV *= Math.exp(-1.35 * dt); freeA += freeV * dt;
    autoA += sdt * (device.reduced ? 0.05 : MO.spinIdle + MO.spinWander * noise1(simT * 0.07)) * (1 - MO.spinHoverSlow * hover);

    const floatAmp = device.reduced ? 0.4 : 1;
    const fy = (Math.sin(simT * 0.61) * MO.floatY[0] + Math.sin(simT * 0.23 + 1.3) * MO.floatY[1] + noise1(simT * 0.35 + 10) * MO.floatY[2]) * floatAmp;
    const fxp = (Math.sin(simT * 0.29 + 0.7) * MO.floatX[0] + noise1(simT * 0.2 + 30) * MO.floatX[1]) * floatAmp;
    const br = Math.sin(simT * MO.breathRate + Math.sin(simT * 0.13) * 1.8);
    const intro = easeOutCubic(clamp(sim.clock / 4.2));

    floatRig.position.set(fxp + shX.x, 0.02 + fy + shY.x - (1 - intro) * 0.35, 0);
    if (T.dock > 0) {
      dockW.set(0, 0, 0).project(camera); dockW.set(0, dock.ndcY, dockW.z).unproject(camera);
      floatRig.position.lerp(dockW, T.dock);
      floatRig.scale.setScalar(lerp(1, dock.scale, T.dock));
    } else floatRig.scale.setScalar(1);
    leanRig.rotation.set(rotX.x + leanX.x + T.tilt + noise1(simT * 0.15 + 70) * 0.03, 0,
      leanZ.x + Math.sin(simT * 0.27) * 0.035 + noise1(simT * 0.18 + 50) * 0.03);
    spinRig.rotation.y = autoA + rotY.x + freeA + T.spin;
    breathRig.scale.setScalar((0.86 + 0.14 * intro) * (1 + br * MO.breath));
    view.br = br; view.intro = intro;
  }

  function updateCore(input) {
    const open = view.open, hover = input.hover;
    const heat = hover + fx.pulse * 0.6 + T.tease * 0.5;
    view.heat = heat; view.pulse = fx.pulse;
    core.scale.setScalar(G.core * (1 + open * 0.55 + T.flash * 0.25 + fx.pulse * 0.1));
    coreMat.uniforms.uIntensity.value = 2.2 + heat * HV.coreHeat + open * 3.5 + T.flash * 8;
  }

  function updateGlow(camera, input) {
    const open = view.open, heat = view.heat, hover = input.hover;
    core.getWorldPosition(coreW);
    coreLight.position.copy(coreW);
    coreLight.intensity = 0.9 + heat * 1.2 + open * 4.5 + T.flash * 16;
    coreGlow.position.copy(coreW); coreGlow.quaternion.copy(camera.quaternion);
    coreGlow.scale.setScalar(1.3 * floatRig.scale.x * (1 + open * 0.35 + T.flash * 0.5 + hover * 0.1));
    coreGlow.material.uniforms.uIntensity.value = 0.42 + heat * 0.35 + open * 0.3 + T.flash * 1.1;
    camera.getWorldDirection(camDir);
    halo.position.copy(coreW).addScaledVector(camDir, 2.5); halo.quaternion.copy(camera.quaternion);
    halo.material.uniforms.uIntensity.value = 0.05 + hover * 0.025 + open * 0.06 + T.flash * 0.12;
  }

  function fireBurst(particles) {
    particles.F.burst = device.reduced ? BL.burstReduced : BL.burst;
    particles.spawnSparks(coreW.x, coreW.y, coreW.z, device.reduced ? BL.sparksReduced : BL.sparks);
    shockT = 0; shock.visible = true;
  }
  function fireSnap(particles) { particles.F.burst = BL.snap; }
  function absorb(particles) { fx.pulse = Math.max(fx.pulse, 0.6); particles.F.burst = BL.absorb; }
  function updateEffects(dt, camera) {
    if (shockT < 0) return;
    shockT += dt; const p = clamp(shockT / BL.shockTime);
    shock.material.uniforms.uP.value = easeOutCubic(p);
    shock.position.copy(coreW); shock.quaternion.copy(camera.quaternion);
    if (p >= 1) { shockT = -1; shock.visible = false; }
  }

  function dispose() {
    const geos = new Set(), mats = new Set();
    for (const o of added) {
      scene.remove(o);
      o.traverse(n => {
        if (n.geometry) geos.add(n.geometry);
        if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => mats.add(m));
      });
    }
    geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose());
  }

  // Where the cursor points, as a point in breathRig space on the plane through the piece (for parts that reach for it).
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  function cursorLocal(input, camera, out) {
    ndc.set(input.x, input.y); ray.setFromCamera(ndc, camera);
    floatRig.getWorldPosition(tmpV); camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir, tmpV);
    if (!ray.ray.intersectPlane(plane, hit)) return out.set(0, 0, 0);
    return breathRig.worldToLocal(out.copy(hit));
  }

  function finish({ materials = {}, updateParts }) {
    return {
      config, group: floatRig, floatRig, view, T, materials,
      hoverRadius: () => G.hoverRadius * floatRig.scale.x,
      advance, surprise, updateMotion,
      updateParts(dt, input, camera) { updateCore(input); updateParts(dt, input, camera); },
      updateGlow, updateEffects, fireBurst, fireSnap, absorb, dispose
    };
  }

  return {
    floatRig, leanRig, spinRig, breathRig, core, fx, view, T, add, finish, cursorLocal,
    get spin() { return autoA; }
  };
}

// a tick-tock clock: advances `steps` per second in eased jumps (for mechanical parts)
export function ticking(t, rate, ease = 0.22) {
  const k = Math.floor(t * rate), f = t * rate - k;
  const x = Math.min(1, f / ease);
  return k + 1 + 1.4 * Math.pow(x - 1, 3) + 0.4 * Math.pow(x - 1, 2);   // easeOutBack, 0 → 1 per tick
}
