// Species: Porcelain Crown. A ring of porcelain shards that float and never touch, each mended
// at its edges with gold (kintsugi), around a small bright star held in a glass lens.
// Hover: the shards find their places and align into a perfect ring, then drift apart again.
import * as THREE from 'three';
import { TAU, lerp, damp, rand, noise1 } from '../lib/kit.js';
import { createBody } from '../lib/body.js';
import { glassMaterial, physical } from '../lib/materials.js';

export const config = {
  id: 'porcelain-crown',
  recipe: 'porcelain-crown',
  name: 'Porcelain Crown',
  medium: 'Porcelain shards, gold seams, one star',
  coreColor: '#ff8fa3',
  palette: {
    coreLight: 0xff8fa3,
    coreHot: [1.0, 0.93, 0.95], coreEdge: [1.0, 0.36, 0.5],
    coreGlow: [1.0, 0.5, 0.62], halo: [0.42, 0.18, 0.28], shock: [1.0, 0.8, 0.86],
    glassRim: [1.0, 0.82, 0.88], glassRimOpen: [1.0, 0.9, 0.92]
  },
  materials: {
    glass: {
      color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.8, ior: 1.55,
      dispersion: 1.0, iridescence: 0.4, iridescenceIOR: 1.3, iridescenceThicknessRange: [200, 500],
      attenuationColor: 0xffd6de, attenuationDistance: 1.2,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6
    },
    porcelain: { color: 0xf6efe8, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.5, sheenColor: 0xffe9ee, sheenRoughness: 0.5, envMapIntensity: 0.9 },
    blush: { color: 0xf3d9da, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: 0xfff0f2, sheenRoughness: 0.5, envMapIntensity: 0.85 },
    gold: { color: 0xe8b98a, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 }
  },
  geometry: {
    core: 0.11, hoverRadius: 1.25, frame: 1.55,
    lens: 0.26,
    shards: { count: 12, radius: 0.92, size: [0.24, 0.38], depth: 0.05 }
  },
  motion: {
    spinIdle: 0.09, spinWander: 0.05, spinHoverSlow: 0.6,
    floatY: [0.06, 0.04, 0.03], floatX: [0.03, 0.02], breath: 0.012, breathRate: 0.7,
    turn: { yaw: 0.9, pitch: 0.4 },
    lean: { roll: 0.18, pitch: 0.16, shiftX: 0.09, shiftY: 0.06 }
  },
  hover: { coreHeat: 2.0, align: 1.0 },
  bloom: { burst: 3.4, burstReduced: 1.2, sparks: 0.9, sparksReduced: 0.3, snap: -1.1, absorb: -0.5, shockScale: 6.5, shockTime: 1.6 },
  particles: { warm: [1.0, 0.55, 0.65], cool: [0.75, 0.65, 1.0], pale: [0.98, 0.93, 0.9], accent: [1.0, 0.8, 0.5] }
};

// a crown point: a tall broken shard with a sharp tip and a chipped base
function shardShape(size) {
  const s = new THREE.Shape(), w = size * rand(0.32, 0.45), h = size * rand(1.3, 1.8);
  const pts = [[0, h * 0.5], [w * rand(0.4, 0.7), h * rand(0.05, 0.2)], [w, -h * rand(0.15, 0.3)], [w * rand(0.3, 0.6), -h * 0.5],
    [-w * rand(0.1, 0.4), -h * rand(0.38, 0.5)], [-w, -h * rand(0.05, 0.25)], [-w * rand(0.3, 0.6), h * rand(0.15, 0.3)]];
  pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  s.closePath();
  return s;
}

export function build(config, ctx) {
  const body = createBody(config, ctx);
  const { breathRig, fx, view, T } = body;
  const { sim } = ctx;
  const C = config.palette, M = config.materials, G = config.geometry, HV = config.hover;

  const glass = glassMaterial(M.glass, C.glassRim);
  const porcelain = physical(M.porcelain), blush = physical(M.blush), gold = physical(M.gold);

  // the star's glass lens, with a thin gold collar
  const lens = new THREE.Mesh(new THREE.SphereGeometry(G.lens, 48, 32), glass.mat); breathRig.add(lens);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(G.lens * 1.02, 0.008, 8, 96), gold); collar.rotation.x = Math.PI / 2; breathRig.add(collar);

  // shards: extruded porcelain with gold sides (kintsugi), each with a scattered pose and a place in the perfect ring
  const S = G.shards, shards = [];
  for (let i = 0; i < S.count; i++) {
    const geo = new THREE.ExtrudeGeometry(shardShape(rand(S.size[0], S.size[1])), {
      depth: S.depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, steps: 1, curveSegments: 1
    });
    geo.center();
    const mesh = new THREE.Mesh(geo, [i % 3 === 1 ? blush : porcelain, gold]); mesh.castShadow = true;
    const holder = new THREE.Group(); holder.add(mesh); breathRig.add(holder);
    const a = i / S.count * TAU;
    shards.push({
      holder, mesh, piece: i % 5, seed: Math.random(),
      ring: { a, r: S.radius, y: 0 },                                       // the perfect ring
      loose: { a: a + rand(-0.12, 0.12), r: S.radius * rand(0.9, 1.1), y: rand(-0.22, 0.22), tx: rand(-0.3, 0.3), tz: rand(-0.28, 0.28) }
    });
  }

  let align = 0;
  const e = new THREE.Euler();
  function updateParts(dt, input) {
    const { simT, clock } = sim, hover = input.hover, open = view.open;
    align = damp(align, Math.min(1, hover * HV.align + T.tease * 0.6), hover > 0.5 ? 2.2 : 0.9, dt);
    for (const s of shards) {
      const oi = (T.petals[s.piece] ? T.petals[s.piece].v : 0);
      const bob = Math.sin(simT * (0.5 + s.seed * 0.4) + s.seed * 20) * 0.06 * (1 - align);
      const a = lerp(s.loose.a + noise1(simT * 0.12 + s.seed * 40) * 0.08, s.ring.a, align) + fx.kick * 0.03;
      const r = lerp(s.loose.r, s.ring.r, align) * (1 + oi * 0.75) + fx.pulse * 0.04;
      const y = lerp(s.loose.y, s.ring.y, align) + bob + oi * (s.seed - 0.5) * 0.9;
      s.holder.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      // face outward; loose shards tumble slowly, aligned ones stand upright
      const tumble = (1 - align) * (1 - oi * 0.5);
      e.set((s.loose.tx + Math.sin(simT * 0.3 + s.seed * 9) * 0.15) * tumble + fx.shiver * 0.2 * Math.sin(clock * 30 + s.seed * 9),
        -a + Math.PI / 2 + oi * 2.2 * (s.seed - 0.5),
        (s.loose.tz + Math.cos(simT * 0.27 + s.seed * 7) * 0.12) * tumble + oi * 1.4 * (s.seed - 0.5), 'YXZ');
      s.holder.quaternion.setFromEuler(e);
    }
    lens.scale.setScalar(1 + open * 0.3 + fx.pulse * 0.05);
    collar.rotation.z = simT * 0.2;
    glass.rim.uRim.value = 0.18 + view.heat * 0.35 + open * 1.0 + T.flash * 1.4;
    glass.rim.uRimColor.value.setRGB(lerp(C.glassRim[0], C.glassRimOpen[0], open), lerp(C.glassRim[1], C.glassRimOpen[1], open), lerp(C.glassRim[2], C.glassRimOpen[2], open));
  }

  return body.finish({ materials: { glass: glass.mat, porcelain, gold }, updateParts });
}
