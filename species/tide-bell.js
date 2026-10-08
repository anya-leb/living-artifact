// Species: Tide Bell. A glass jellyfish bell that breathes in slow pulses, trailing ribbons of
// liquid metal. The bell is five segments (the shell pieces); hover lifts and spreads the ribbons.
import * as THREE from 'three';
import { TAU, lerp, damp, rand, noise1, NOISE } from '../lib/kit.js';
import { createBody } from '../lib/body.js';
import { glassMaterial, physical } from '../lib/materials.js';

export const config = {
  id: 'tide-bell',
  recipe: 'tide-bell',
  name: 'Tide Bell',
  medium: 'Glass, quicksilver ribbons and tidal light',
  coreColor: '#4fd8c8',
  palette: {
    coreLight: 0x4fd8c8,
    coreHot: [0.85, 1.0, 0.97], coreEdge: [0.08, 0.72, 0.66],
    coreGlow: [0.2, 0.85, 0.78], halo: [0.08, 0.32, 0.42], shock: [0.55, 1.0, 0.95],
    glassRim: [0.55, 1.0, 0.92], glassRimOpen: [0.9, 1.0, 0.96],
    ribbonGlow: [0.15, 0.9, 0.8]
  },
  materials: {
    glass: {
      color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.6, ior: 1.42,
      dispersion: 0.6, iridescence: 0.7, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 460],
      attenuationColor: 0x7fe3d6, attenuationDistance: 0.85,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5
    },
    ribbon: { color: 0xc4ece6, metalness: 1, roughness: 0.12, envMapIntensity: 1.5 },
    porcelain: { color: 0xeef2ee, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: 0xe8fff9, sheenRoughness: 0.5, envMapIntensity: 0.85 }
  },
  geometry: {
    core: 0.15, coreY: 0.42, offsetY: 0.55, hoverRadius: 1.25, frame: 1.75,
    bell: [[0.001, 0.92], [0.25, 0.9], [0.5, 0.82], [0.72, 0.66], [0.88, 0.45], [0.98, 0.22], [1.04, 0.0], [1.07, -0.13], [1.11, -0.2]],
    segments: 5, gap: 0.045,
    ribbons: { count: 7, length: [1.5, 2.4], width: 0.055 }
  },
  motion: {
    spinIdle: 0.07, spinWander: 0.04, spinHoverSlow: 0.4,
    floatY: [0.12, 0.05, 0.04], floatX: [0.05, 0.03], breath: 0.01, breathRate: 0.6,
    turn: { yaw: 0.8, pitch: 0.32 },
    lean: { roll: 0.16, pitch: 0.12, shiftX: 0.1, shiftY: 0.07 },
    pulsePeriod: 4.2
  },
  hover: { coreHeat: 1.6, lift: 0.75 },
  bloom: { burst: 3.2, burstReduced: 1.2, sparks: 0.8, sparksReduced: 0.3, snap: -1.0, absorb: -0.5, shockScale: 7, shockTime: 1.9 },
  particles: { warm: [0.25, 0.95, 0.85], cool: [0.4, 0.7, 1.0], pale: [0.88, 0.97, 0.96], accent: [0.7, 0.55, 1.0] }
};

export function build(config, ctx) {
  const body = createBody(config, ctx);
  const { breathRig, spinRig, fx, view, T } = body;
  const { sim } = ctx;
  const C = config.palette, M = config.materials, G = config.geometry, MO = config.motion, HV = config.hover;

  const glass = glassMaterial(M.glass, C.glassRim);
  const porcelain = physical(M.porcelain);

  // the bell: five lathe segments hinged at the apex, so they can swing open like a flower turned upside down
  const bell = new THREE.Group(); breathRig.add(bell);
  const apex = new THREE.Vector3(0, G.bell[0][1], 0);
  const profile = G.bell.map(([x, y]) => new THREE.Vector2(x, y));
  const segLen = TAU / G.segments - G.gap;
  const beadGeo = new THREE.SphereGeometry(1, 16, 12);
  const segments = [];
  for (let i = 0; i < G.segments; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i / G.segments * TAU; bell.add(arm);
    const hinge = new THREE.Group(); hinge.position.copy(apex); arm.add(hinge);
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 22, -segLen / 2, segLen), glass.mat);
    mesh.position.copy(apex).negate(); mesh.castShadow = true; hinge.add(mesh);
    // porcelain beads stitched along the rim of each segment
    const rim = G.bell[G.bell.length - 1];
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * segLen * 0.33;
      const b = new THREE.Mesh(beadGeo, porcelain); b.scale.setScalar(0.028 + 0.01 * (k === 1));
      b.position.set(Math.sin(a) * rim[0], rim[1] - 0.015, Math.cos(a) * rim[0]).sub(apex);
      b.castShadow = true; hinge.add(b);
    }
    segments.push({ hinge, seed: Math.random() });
  }

  // a porcelain stalk hanging inside the bell, under the core
  const stalkProf = [[0.001, 0.5], [0.06, 0.46], [0.09, 0.3], [0.07, 0.05], [0.05, -0.2], [0.03, -0.42], [0.001, -0.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const stalk = new THREE.Mesh(new THREE.LatheGeometry(stalkProf, 24), porcelain); stalk.castShadow = true;
  stalk.position.y = 0.05; breathRig.add(stalk);

  // ribbons of liquid metal: long strips that ripple, twist and trail; uLift spreads them outward
  const ribbons = [];
  const ribbonShader = (u) => (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uLift, uLen, uPhase, uPulse;
        ${NOISE}
        vec3 laRibbon(vec3 p, out float tw){
          float s = clamp(-p.y / uLen, 0.0, 1.0);
          tw = s * 3.0 + sin(uTime * 0.7 + uPhase) * 0.8;
          vec3 q = vec3(p.x * cos(tw), p.y, p.x * sin(tw));
          q.x += sin(uTime * 1.3 - s * 6.0 + uPhase) * 0.13 * s + laNoise(vec3(s * 2.0, uTime * 0.3, uPhase)) * 0.06 * s;
          q.z += cos(uTime * 0.9 - s * 4.0 + uPhase) * 0.09 * s + uLift * pow(s, 1.3) * 0.9 + uPulse * s * 0.15;
          q.y += uLift * s * s * 0.55 - uPulse * s * 0.08;
          return q;
        }`)
      .replace('#include <beginnormal_vertex>', `float laTw; vec3 laQ = laRibbon(position, laTw);
        vec3 objectNormal = vec3(-sin(laTw), 0.0, cos(laTw)) * sign(normal.z + 1e-4);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = laQ;');
  };
  for (let k = 0; k < G.ribbons.count; k++) {
    const len = rand(G.ribbons.length[0], G.ribbons.length[1]);
    const geo = new THREE.PlaneGeometry(G.ribbons.width, len, 1, 72); geo.translate(0, -len / 2, 0);
    const u = { uTime: { value: 0 }, uLift: { value: 0 }, uLen: { value: len }, uPhase: { value: rand(0, TAU) }, uPulse: { value: 0 } };
    const mat = physical(M.ribbon, { side: THREE.DoubleSide, emissive: new THREE.Color(...C.ribbonGlow), emissiveIntensity: 0.12 });
    mat.onBeforeCompile = ribbonShader(u);
    mat.customProgramCacheKey = () => 'tide-bell-ribbon';
    const arm = new THREE.Group(); arm.rotation.y = k / G.ribbons.count * TAU + rand(-0.2, 0.2); spinRig.add(arm);
    const r = rand(0.45, 0.8);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(0, (G.offsetY || 0) - 0.12, r); mesh.castShadow = true; arm.add(mesh);
    ribbons.push({ u, r, mesh });
  }

  // the tide: a quick contraction, then a long slow release
  const pulseWave = (t) => { const c = (t / MO.pulsePeriod) % 1; return c < 0.22 ? Math.sin(c / 0.22 * Math.PI / 2) : Math.cos((c - 0.22) / 0.78 * Math.PI / 2) ** 2; };
  let lift = 0;

  function updateParts(dt, input) {
    const { simT, clock } = sim, hover = input.hover, open = view.open;
    const pw = pulseWave(simT * (1 + hover * 0.6)) + fx.pulse * 0.5;
    bell.scale.set(1 - 0.07 * pw, 1 + 0.06 * pw, 1 - 0.07 * pw);
    bell.position.y = 0.05 * pw;

    for (let i = 0; i < segments.length; i++) {
      const s = segments[i], oi = (T.petals[i] ? T.petals[i].v : 0) + T.tease * 0.18;
      const wob = fx.shiver * 0.06 * Math.sin(clock * 30 + i * 1.3) + hover * 0.03 * Math.sin(clock * 1.4 + s.seed * 9);
      s.hinge.rotation.set(-oi * 0.85 - wob, 0, oi * 0.2 * (i % 2 ? 1 : -1));
      s.hinge.position.y = G.bell[0][1] + Math.max(0, oi) * (0.1 + 0.1 * s.seed);
    }
    stalk.rotation.z = noise1(simT * 0.4 + 3) * 0.08 + fx.sway * 0.15 * Math.sin(clock * 4);

    lift = damp(lift, hover * HV.lift + open * 1.1 + T.tease * 0.3, 2.4, dt);
    for (const r of ribbons) {
      r.u.uTime.value = simT; r.u.uLift.value = lift; r.u.uPulse.value = pw;
      r.mesh.position.z = r.r * (1 + 0.25 * lift);
    }
    glass.rim.uRim.value = 0.14 + view.heat * 0.3 + open * 1.0 + T.flash * 1.4 + pw * 0.08;
    glass.rim.uRimColor.value.setRGB(lerp(C.glassRim[0], C.glassRimOpen[0], open), lerp(C.glassRim[1], C.glassRimOpen[1], open), lerp(C.glassRim[2], C.glassRimOpen[2], open));
  }

  return body.finish({ materials: { glass: glass.mat, porcelain }, updateParts });
}
