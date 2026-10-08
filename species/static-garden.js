// Species: Static Garden. A frozen firework: thin mercury spikes growing out of a violet core,
// tipped with ice-blue light and a few porcelain seeds, inside five nested glass rings that turn
// on different axes. Hover: the spikes bend toward the cursor.
import * as THREE from 'three';
import { TAU, lerp, damp, rand, noise1, color } from '../lib/kit.js';
import { createBody } from '../lib/body.js';
import { glassMaterial, physical } from '../lib/materials.js';

export const config = {
  id: 'static-garden',
  recipe: 'static-garden',
  name: 'Static Garden',
  medium: 'Ice glass, mercury spines, held breath',
  coreColor: '#a98bff',
  palette: {
    coreLight: 0xa98bff,
    coreHot: [0.96, 0.92, 1.0], coreEdge: [0.5, 0.32, 1.0],
    coreGlow: [0.6, 0.45, 1.0], halo: [0.22, 0.22, 0.58], shock: [0.75, 0.82, 1.0],
    glassRim: [0.7, 0.85, 1.0], glassRimOpen: [0.85, 0.8, 1.0],
    tipIce: [0.8, 1.5, 2.4], tipViolet: [1.5, 0.9, 2.6]
  },
  materials: {
    glass: {
      color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.3, ior: 1.5,
      dispersion: 1.2, iridescence: 0.8, iridescenceIOR: 1.35, iridescenceThicknessRange: [160, 480],
      attenuationColor: 0xcfdcff, attenuationDistance: 0.7,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6
    },
    spike: { color: 0xd6d4ee, metalness: 1, roughness: 0.1, envMapIntensity: 1.5 },
    porcelain: { color: 0xf0eef6, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, sheen: 0.45, sheenColor: 0xf0eaff, sheenRoughness: 0.5, envMapIntensity: 0.85 }
  },
  geometry: {
    core: 0.16, hoverRadius: 1.3, frame: 1.65,
    spikes: { count: 54, length: [0.45, 1.3] },
    rings: [ // radius, tube, tilt x, tilt z, spin axis speed
      { r: 0.42, t: 0.012, tx: 0.3, tz: 0.1, s: 0.5 },
      { r: 0.62, t: 0.014, tx: 1.1, tz: -0.4, s: -0.35 },
      { r: 0.84, t: 0.016, tx: 1.7, tz: 0.6, s: 0.25 },
      { r: 1.08, t: 0.017, tx: 0.9, tz: 1.2, s: -0.18 },
      { r: 1.34, t: 0.018, tx: 1.45, tz: -0.2, s: 0.12 }
    ]
  },
  motion: {
    spinIdle: 0.04, spinWander: 0.03, spinHoverSlow: 0.6,
    floatY: [0.045, 0.03, 0.025], floatX: [0.025, 0.015], breath: 0.01, breathRate: 0.5,
    turn: { yaw: 0.9, pitch: 0.4 },
    lean: { roll: 0.18, pitch: 0.15, shiftX: 0.08, shiftY: 0.06 }
  },
  hover: { coreHeat: 1.8, bend: 0.9 },
  bloom: { burst: 3.6, burstReduced: 1.3, sparks: 1, sparksReduced: 0.35, snap: -1.2, absorb: -0.6, shockScale: 8, shockTime: 1.7 },
  particles: { warm: [0.65, 0.5, 1.0], cool: [0.5, 0.8, 1.0], pale: [0.92, 0.93, 1.0], accent: [1.0, 0.6, 0.85] }
};

export function build(config, ctx) {
  const body = createBody(config, ctx);
  const { breathRig, spinRig, fx, view, T } = body;
  const { sim } = ctx;
  const C = config.palette, M = config.materials, G = config.geometry, HV = config.hover;

  const glass = glassMaterial(M.glass, C.glassRim);
  const spikeMat = physical(M.spike), porcelain = physical(M.porcelain);

  // spikes on a fibonacci sphere, slightly clumped, each a thin cone with its base at the core
  const N = G.spikes.count;
  const coneGeo = new THREE.ConeGeometry(0.014, 1, 6, 1); coneGeo.translate(0, 0.5, 0);
  const spikes = new THREE.InstancedMesh(coneGeo, spikeMat, N); spikes.castShadow = true; breathRig.add(spikes);
  const tips = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), N); breathRig.add(tips);
  const seeds = [];
  const dirs = [], lens = [], phase = [];
  const ice = color(THREE, C.tipIce), violet = color(THREE, C.tipViolet), tint = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
    dirs.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).add(new THREE.Vector3(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15))).normalize());
    lens.push(rand(G.spikes.length[0], G.spikes.length[1]) * (Math.random() < 0.15 ? 1.25 : 1));
    phase.push(Math.random() * TAU);
    tips.setColorAt(i, tint.copy(Math.random() < 0.6 ? ice : violet));
    if (i % 7 === 3) {   // a few porcelain seeds riding the longer spikes
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), porcelain); s.castShadow = true; breathRig.add(s);
      seeds.push({ i, mesh: s, at: rand(0.55, 0.8) });
    }
  }
  tips.instanceColor.needsUpdate = true;

  // five nested glass rings: the shell pieces
  const rings = G.rings.map((g, k) => {
    const pivot = new THREE.Group(); pivot.rotation.set(g.tx, 0, g.tz); spinRig.add(pivot);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(g.r, g.t, 10, 160), glass.mat); ring.castShadow = true; pivot.add(ring);
    return { pivot, ring, g, seed: Math.random() };
  });

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), p = new THREE.Vector3();
  const s3 = new THREE.Vector3(), cursor = new THREE.Vector3(), toward = new THREE.Vector3();
  let bend = 0;

  function updateParts(dt, input, camera) {
    const { simT, clock, sdt } = sim, hover = input.hover, open = view.open;
    bend = damp(bend, hover * HV.bend, 3, dt);
    if (bend > 0.002 && camera) body.cursorLocal(input, camera, cursor); else cursor.set(0, 0, 0);
    const reach = cursor.lengthSq() > 1e-6;
    if (reach) toward.copy(cursor).normalize();
    for (let i = 0; i < N; i++) {
      d.copy(dirs[i]);
      // reach toward the cursor: spikes already pointing that way lean in the most
      if (reach) d.addScaledVector(toward, bend * Math.max(0, d.dot(toward) + 0.35) * 0.8).normalize();
      d.x += fx.shiver * 0.04 * Math.sin(clock * 34 + i);
      const grow = 1 + 0.05 * Math.sin(simT * 0.8 + phase[i]) + open * 0.45 + fx.pulse * 0.08 + T.tease * 0.1;
      const L = lens[i] * grow;
      q.setFromUnitVectors(up, d.normalize());
      m4.compose(p.set(0, 0, 0), q, s3.set(1, L, 1)); spikes.setMatrixAt(i, m4);
      m4.compose(p.copy(d).multiplyScalar(L), q, s3.set(1, 1, 1).multiplyScalar(1 + 0.35 * Math.sin(simT * 2.3 + phase[i]) ** 2)); tips.setMatrixAt(i, m4);
    }
    for (const s of seeds) s.mesh.position.copy(dirs[s.i]).multiplyScalar(lens[s.i] * s.at * (1 + open * 0.45));
    spikes.instanceMatrix.needsUpdate = true; tips.instanceMatrix.needsUpdate = true;
    tips.material.color.setScalar(1 + view.heat * 0.6 + open * 1.2 + T.flash * 2);

    rings.forEach((r, k) => {
      const oi = (T.petals[k] ? T.petals[k].v : 0);
      r.ring.rotation.z += sdt * (r.g.s * (1 + hover * 0.8) + fx.kick * 0.2);
      r.pivot.rotation.x = r.g.tx + Math.sin(simT * 0.2 + k) * 0.06 - oi * (r.g.tx - Math.PI / 2) * 0.8;
      r.pivot.rotation.z = r.g.tz * (1 - oi * 0.8);
      r.ring.scale.setScalar(1 + oi * (0.35 + 0.12 * k));
    });
    glass.rim.uRim.value = 0.2 + view.heat * 0.3 + open * 1.0 + T.flash * 1.4;
    glass.rim.uRimColor.value.setRGB(lerp(C.glassRim[0], C.glassRimOpen[0], open), lerp(C.glassRim[1], C.glassRimOpen[1], open), lerp(C.glassRim[2], C.glassRimOpen[2], open));
  }

  return body.finish({ materials: { glass: glass.mat, spike: spikeMat, porcelain }, updateParts });
}
