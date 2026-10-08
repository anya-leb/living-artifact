// Species: Clockwork Seed. A brass pod of interlocking plates in three bands that tick against
// each other like a clock, an amber heart showing through the gaps, and one glass wing that
// turns the whole seed slowly, like a maple key falling. Hover: the plates click open a few degrees.
import * as THREE from 'three';
import { TAU, lerp, damp, rand, noise1 } from '../lib/kit.js';
import { createBody, ticking } from '../lib/body.js';
import { glassMaterial, physical, liquidMetalMaterial } from '../lib/materials.js';

export const config = {
  id: 'clockwork-seed',
  recipe: 'clockwork-seed',
  name: 'Clockwork Seed',
  medium: 'Brass plates, glass wing, amber heart',
  coreColor: '#ffb347',
  palette: {
    coreLight: 0xffb347,
    coreHot: [1.0, 0.95, 0.78], coreEdge: [1.0, 0.52, 0.1],
    coreGlow: [1.0, 0.62, 0.24], halo: [0.4, 0.26, 0.12], shock: [1.0, 0.82, 0.5],
    glassRim: [1.0, 0.86, 0.6], glassRimOpen: [1.0, 0.75, 0.45],
    molten: [1.0, 0.55, 0.15]
  },
  materials: {
    glass: {
      color: 0xffffff, metalness: 0, roughness: 0.06, transmission: 1, thickness: 0.35, ior: 1.5,
      dispersion: 0.5, iridescence: 0.5, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 520],
      attenuationColor: 0xffc98a, attenuationDistance: 0.6,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5
    },
    brass: { color: 0xd8a45c, metalness: 1, roughness: 0.2, envMapIntensity: 1.35, clearcoat: 0.3, clearcoatRoughness: 0.2 },
    darkBrass: { color: 0x9c7342, metalness: 1, roughness: 0.32, envMapIntensity: 1.1 },
    porcelain: { color: 0xf3ece2, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, sheen: 0.4, sheenColor: 0xfff1e0, sheenRoughness: 0.5, envMapIntensity: 0.85 },
    mercury: { color: 0xe6d2b4, metalness: 1, roughness: 0.06, envMapIntensity: 1.5 }
  },
  geometry: {
    core: 0.17, hoverRadius: 1.2, frame: 1.6,
    bands: [ // theta range, radius, plates, spin direction
      { th: [0.32, 1.12], r: 0.6, n: 6, dir: 1 },
      { th: [1.12, 2.02], r: 0.64, n: 6, dir: -1 },
      { th: [2.02, 2.82], r: 0.6, n: 6, dir: 1 }
    ],
    plateGap: 0.2, yStretch: 1.22,
    wing: { length: 1.95, width: 0.62 }
  },
  motion: {
    spinIdle: 0.42, spinWander: 0.08, spinHoverSlow: 0.7,
    floatY: [0.06, 0.035, 0.03], floatX: [0.03, 0.02], breath: 0.008, breathRate: 0.85,
    turn: { yaw: 0.9, pitch: 0.36 },
    lean: { roll: 0.2, pitch: 0.16, shiftX: 0.09, shiftY: 0.06 },
    tickRate: 1.4
  },
  hover: { coreHeat: 1.8, click: 0.16 },
  bloom: { burst: 4.0, burstReduced: 1.4, sparks: 1, sparksReduced: 0.35, snap: -1.3, absorb: -0.6, shockScale: 7.5, shockTime: 1.6 },
  particles: { warm: [1.0, 0.66, 0.25], cool: [1.0, 0.85, 0.55], pale: [0.96, 0.9, 0.82], accent: [0.55, 0.75, 1.0] }
};

export function build(config, ctx) {
  const body = createBody(config, ctx);
  const { breathRig, spinRig, fx, view, T } = body;
  const { sim } = ctx;
  const C = config.palette, M = config.materials, G = config.geometry, MO = config.motion, HV = config.hover;

  const brass = physical(M.brass, { side: THREE.DoubleSide });
  const darkBrass = physical(M.darkBrass);
  const porcelain = physical(M.porcelain);
  const glass = glassMaterial(M.glass, C.glassRim);
  const mercury = liquidMetalMaterial(M.mercury, C.molten);

  // inner mercury pod around the core, seen through the gaps between plates
  const pod = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mercury.mat);
  pod.scale.set(0.34, 0.34 * G.yStretch, 0.34); breathRig.add(pod);

  // the plates: sphere patches in three counter-rotating bands, each hinged on its upper edge
  const pod3 = new THREE.Group(); pod3.scale.y = G.yStretch; breathRig.add(pod3);
  const bands = [];
  let plateIndex = 0;
  for (const band of G.bands) {
    const ring = new THREE.Group(); pod3.add(ring);
    const phiLen = TAU / band.n - G.plateGap;
    const plates = [];
    for (let j = 0; j < band.n; j++) {
      const geo = new THREE.SphereGeometry(band.r, 14, 10, -phiLen / 2 + Math.PI / 2, phiLen, band.th[0], band.th[1] - band.th[0]);
      // hinge along the plate's upper edge so it can lift open like a scale
      const top = new THREE.Vector3(0, Math.cos(band.th[0]) * band.r, Math.sin(band.th[0]) * band.r);
      const arm = new THREE.Group(); arm.rotation.y = j / band.n * TAU; ring.add(arm);
      const hinge = new THREE.Group(); hinge.position.copy(top); arm.add(hinge);
      const mesh = new THREE.Mesh(geo, brass); mesh.position.copy(top).negate(); mesh.castShadow = true; hinge.add(mesh);
      // a porcelain rivet on each plate
      const mid = (band.th[0] + band.th[1]) / 2;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), porcelain);
      rivet.position.set(0, Math.cos(mid) * band.r * 1.01, Math.sin(mid) * band.r * 1.01).sub(top); hinge.add(rivet);
      plates.push({ hinge, piece: plateIndex++ % 5, seed: Math.random() });
    }
    bands.push({ ring, plates, dir: band.dir });
  }
  // gear rings between the bands
  for (const th of [1.12, 2.02]) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(th) * 0.66, 0.012, 6, 90), darkBrass);
    g.rotation.x = Math.PI / 2; g.position.y = Math.cos(th) * 0.66; pod3.add(g);
  }
  // porcelain tip below, bearing on top
  const tipProf = [[0.001, -0.62], [0.05, -0.66], [0.06, -0.78], [0.035, -0.92], [0.001, -1.0]].map(([x, y]) => new THREE.Vector2(x, y * G.yStretch));
  const tip = new THREE.Mesh(new THREE.LatheGeometry(tipProf, 24), porcelain); tip.castShadow = true; breathRig.add(tip);
  const bearing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 12, 32), porcelain);
  bearing.rotation.x = Math.PI / 2; bearing.position.y = 0.78; breathRig.add(bearing);

  // the wing: one curved blade of glass with metal veins, rooted at the top
  const wingRoot = new THREE.Group(); wingRoot.position.y = 0.8; spinRig.add(wingRoot);
  const W = G.wing;
  const wingPoint = (u, v, out) => {
    const w = W.width * Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.35 * u);
    out.set(u * W.length, 0.25 * Math.sin(Math.PI * u * 0.8) - 0.15 * u * u, (v - 0.35) * w);
    out.y += 0.06 * Math.sin(Math.PI * v) * (1 - u);      // camber
    return out;
  };
  const wingGeo = (() => {
    const su = 40, sv = 10, pos = [], idx = [], p = new THREE.Vector3();
    for (let i = 0; i <= su; i++) for (let j = 0; j <= sv; j++) { wingPoint(i / su, j / sv, p); pos.push(p.x, p.y, p.z); }
    for (let i = 0; i < su; i++) for (let j = 0; j < sv; j++) { const a = i * (sv + 1) + j, b = a + sv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const wing = new THREE.Mesh(wingGeo, glass.mat); wing.castShadow = true; wingRoot.add(wing);
  for (const v of [0.18, 0.45, 0.72]) {
    const pts = []; const p = new THREE.Vector3();
    for (let i = 0; i <= 12; i++) pts.push(wingPoint(i / 12 * (0.92 - v * 0.2), v, p).clone());
    const vein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.006, 5), darkBrass);
    wingRoot.add(vein);
  }

  let click = 0;
  function updateParts(dt, input) {
    const { simT, clock, sdt } = sim, hover = input.hover, open = view.open;
    // bands tick against each other; a surprise kick makes them spin up for a moment
    const tick = ticking(simT, MO.tickRate * (1 + hover * 0.5));
    bands.forEach((b, k) => { b.ring.rotation.y = b.dir * (tick * TAU / 24 * (k === 1 ? 1.5 : 1)) + fx.kick * 0.2 * b.dir; });
    // hover: plates click open in three small steps
    click = damp(click, Math.round((hover + T.tease * 0.5) * 3) / 3, 9, dt);
    for (const b of bands) for (const p of b.plates) {
      const oi = (T.petals[p.piece] ? T.petals[p.piece].v : 0);
      const shake = fx.shiver * 0.05 * Math.sin(clock * 38 + p.seed * 20);
      p.hinge.rotation.x = -(0.07 + click * HV.click + oi * 1.25 + shake);   // plates rest slightly ajar
      p.hinge.rotation.z = oi * 0.4 * (p.seed - 0.5);
    }
    mercury.u.uTime.value += dt * (1 + hover + open * 2);
    mercury.u.uAmp.value = 0.06 + hover * 0.04 + open * 0.1;
    mercury.u.uHole.value = 0.28 - hover * 0.12 - open * 0.7;
    mercury.u.uGlow.value = 0.9 + view.heat * 1.2 + open * 2.5;
    // the wing rises and flattens as the seed opens; it flutters on a sway
    wingRoot.rotation.z = 0.25 + open * 0.55 + fx.sway * 0.25 * Math.sin(clock * 6) + noise1(simT * 0.5) * 0.04;
    wingRoot.rotation.x = noise1(simT * 0.4 + 9) * 0.06;
    glass.rim.uRim.value = 0.45 + view.heat * 0.3 + open * 1.0 + T.flash * 1.4;
    glass.rim.uRimColor.value.setRGB(lerp(C.glassRim[0], C.glassRimOpen[0], open), lerp(C.glassRim[1], C.glassRimOpen[1], open), lerp(C.glassRim[2], C.glassRimOpen[2], open));
  }

  return body.finish({ materials: { brass, glass: glass.mat, porcelain, mercury: mercury.mat }, updateParts });
}
