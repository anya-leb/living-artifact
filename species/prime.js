// Species: Prime, "The Living Artifact". The original sculpture.
//
// A species is data (`config`) plus the build function for its geometry recipe.
// The stage and (later) every gallery frame call build(config, ctx) and drive the result
// through the same interface; a swap exchanges configs, never meshes.
//
// ctx: { scene, spot, coreLight, U, sim, device, T, dock }
//   T     transition channels shared with the state machine (open, flash, spin, slow, tilt, dock, warm, tease, petals[])
//   dock  { scale, ndcY } where the docked artifact sits on screen

import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, damp, rand, easeOutCubic, noise1, spring, stepSpring, NOISE, UV_VERT, color } from '../lib/kit.js';

export const config = {
  id: 'prime',
  recipe: 'prime',
  name: 'The Living Artifact',
  medium: 'Glass, mercury, porcelain and patient light',   // [EDIT] finalised in gallery phase 2
  coreColor: '#ffa35c',                                      // page and fog tint when this piece holds the stage

  palette: {
    coreLight: 0xffa35c,
    coreHot: [1.0, 0.94, 0.82], coreEdge: [1.0, 0.42, 0.14],
    coreGlow: [1.0, 0.58, 0.28], halo: [0.22, 0.38, 0.75], shock: [1.0, 0.78, 0.55], beam: [1.0, 0.9, 0.78],
    moltenEdge: [1.0, 0.5, 0.2],                              // glow on the liquid metal's open edges
    glassRim: [0.75, 0.9, 1.0], glassRimOpen: [1.0, 0.72, 0.5],
    tips: [[0.55, 1.35, 2.1], [2.2, 1.35, 0.6]],              // stamen tips, alternating cool / warm
    beadWarm: [2.4, 1.5, 0.7], beadCool: [0.7, 1.6, 2.4]
  },

  materials: {
    glass: {
      color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.95, ior: 1.52,
      dispersion: 0.9, iridescence: 0.95, iridescenceIOR: 1.33, iridescenceThicknessRange: [140, 520],
      attenuationColor: 0xb6e2ff, attenuationDistance: 0.9,
      specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6
    },
    chrome: { color: 0xdfe5ee, metalness: 1, roughness: 0.1, envMapIntensity: 1.4, clearcoat: 0.4 },
    gold: { color: 0xe2b77d, metalness: 1, roughness: 0.2, envMapIntensity: 1.25 },
    porcelain: {
      color: 0xf2ede5, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07,
      sheen: 0.45, sheenColor: 0xfff3e6, sheenRoughness: 0.55, envMapIntensity: 0.85
    },
    liquidMetal: { color: 0xd3d9e2, metalness: 1, roughness: 0.07, envMapIntensity: 1.5 }
  },

  geometry: {
    core: 0.19, liquidMetal: 0.5,
    petals: { count: 5, segU: 18, segV: 46, top: 0.17, bottom: 0.34, width: 0.9, twist: 0.55 },
    calyx: {
      profile: [[0.001, -1.30], [0.10, -1.295], [0.2, -1.26], [0.31, -1.19], [0.42, -1.09], [0.52, -0.97], [0.6, -0.86],
        [0.66, -0.78], [0.678, -0.742], [0.66, -0.73], [0.6, -0.79], [0.5, -0.915], [0.38, -1.025], [0.24, -1.105], [0.1, -1.145], [0.001, -1.155]],
      scallop: 0.032, band: { radius: 0.603, y: -0.86 }
    },
    crown: { y: 1.0 },
    tendrils: { count: 5, length: [0.62, 1.0], curl: [0.75, 1.2] },
    rings: [
      { radius: 1.36, tube: 0.0065, metal: 'chrome', tilt: [Math.PI / 2 - 0.42, 0.15],
        beads: [[0, 0.045, 'porcelain'], [2.1, 0.034, 'porcelain'], [2.35, 0.018, 'warm'], [4.2, 0.04, 'porcelain']] },
      { radius: 1.52, tube: 0.0042, metal: 'gold', tilt: [Math.PI / 2 + 0.62, -0.35],
        beads: [[1.0, 0.03, 'porcelain'], [3.9, 0.016, 'cool']] }
    ]
  },

  // idle life and how the piece follows the cursor
  motion: {
    spinIdle: 0.13, spinWander: 0.05, spinHoverSlow: 0.55,
    floatY: [0.075, 0.045, 0.03], floatX: [0.03, 0.02], breath: 0.014,
    turn: { yaw: 0.95, pitch: 0.38 },
    lean: { roll: 0.2, pitch: 0.16, shiftX: 0.09, shiftY: 0.06 }
  },

  // what changes while the cursor is over it
  hover: { petalWobble: 0.07, tendrilSway: 0.12, coreHeat: 1.8 },

  // its version of the opening bloom
  bloom: { burst: 3.8, burstReduced: 1.4, sparks: 1, sparksReduced: 0.35, snap: -1.2, absorb: -0.6, shockScale: 7.5, shockTime: 1.7 },

  // orbiting particles and room dust: warm, cool, pale and a rare accent
  particles: { warm: [1.0, 0.62, 0.3], cool: [0.45, 0.8, 1.0], pale: [0.95, 0.92, 0.88], accent: [1.0, 0.45, 0.55] }
};

export function build(config, ctx) {
  const { scene, spot, coreLight, U, sim, device, T, dock } = ctx;
  const C = config.palette, M = config.materials, G = config.geometry, MO = config.motion, HV = config.hover, BL = config.bloom;
  const added = [];                       // scene-level objects this species owns (removed on dispose)
  const addToScene = (o) => { scene.add(o); added.push(o); return o; };
  coreLight.color.set(C.coreLight);

  /* ---- materials */
  const glassMat = new THREE.MeshPhysicalMaterial({
    ...M.glass, attenuationColor: new THREE.Color(M.glass.attenuationColor),
    side: THREE.DoubleSide, depthWrite: false
  });
  // Glass edges catch the core's light: a fresnel rim that brightens on hover and when the petals open.
  const glassRim = { uRim: { value: 0.1 }, uRimColor: { value: color(THREE, C.glassRim) } };
  glassMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, glassRim);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uRim; uniform vec3 uRimColor;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float laF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRimColor * laF * uRim;`);
  };
  glassMat.customProgramCacheKey = () => 'living-artifact-glass';
  const chromeMat = new THREE.MeshPhysicalMaterial({ ...M.chrome });
  const goldMat = new THREE.MeshPhysicalMaterial({ ...M.gold });
  const porcelainMat = new THREE.MeshPhysicalMaterial({ ...M.porcelain, sheenColor: new THREE.Color(M.porcelain.sheenColor) });

  // Liquid metal: a displaced chrome sphere whose surface opens into molten-edged holes.
  const BU = {
    uTime: { value: 0 }, uAmp: { value: 0.07 }, uHole: { value: 0.34 },
    uGlow: { value: 1.2 }, uGlowColor: { value: color(THREE, C.moltenEdge) }
  };
  const blobMat = new THREE.MeshPhysicalMaterial({ ...M.liquidMetal, side: THREE.DoubleSide });
  blobMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, BU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp;
        varying vec3 vLaDir;
        ${NOISE}
        vec3 laDisplace(vec3 d){
          float n = laNoise(d * 1.5 + vec3(0.0, uTime * 0.35, uTime * 0.1)) * 0.7 + laNoise(d * 3.2 - vec3(uTime * 0.22)) * 0.3;
          return d * (1.0 + uAmp * n);
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 laN = normalize(position);
        vec3 laRef = abs(laN.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 laT = normalize(cross(laN, laRef));
        vec3 laB = cross(laN, laT);
        vec3 laP0 = laDisplace(laN);
        vec3 laP1 = laDisplace(normalize(laN + laT * 0.02));
        vec3 laP2 = laDisplace(normalize(laN + laB * 0.02));
        vec3 objectNormal = normalize(cross(laP1 - laP0, laP2 - laP0));
        vLaDir = laN;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = laP0;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uHole; uniform float uGlow; uniform vec3 uGlowColor;
        varying vec3 vLaDir;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float laH = laNoise(vLaDir * 2.2 + vec3(uTime * 0.11, -uTime * 0.07, uTime * 0.05)) * 0.75
                  + laNoise(vLaDir * 5.5 - uTime * 0.09) * 0.25;
        if (laH > uHole) discard;
        float laEdge = smoothstep(uHole - 0.16, uHole, laH);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowColor * uGlow * laEdge * laEdge;
        if (!gl_FrontFacing) totalEmissiveRadiance += uGlowColor * uGlow * 0.12;`);
  };
  blobMat.customProgramCacheKey = () => 'living-artifact-blob';

  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uIntensity: { value: 2 },
      uHot: { value: color(THREE, C.coreHot) }, uEdge: { value: color(THREE, C.coreEdge) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uIntensity; uniform vec3 uHot, uEdge; varying vec3 vN, vV, vP; ${NOISE}
      void main(){
        float f = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
        float n = laNoise(vP * 3.5 + vec3(0.0, uTime * 0.7, uTime * 0.3)) * 0.5 + 0.5;
        vec3 c = mix(uHot, uEdge, clamp(f * 1.2 + n * 0.3 - 0.1, 0.0, 1.0));
        gl_FragColor = vec4(c * uIntensity * (0.75 + 0.5 * n) * (1.0 - 0.45 * f), 1.0);
      }`
  });

  function glowMaterial(col, falloff, depthTest = false) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: col }, uIntensity: { value: 1 }, uFall: { value: falloff } },
      transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending,
      vertexShader: UV_VERT,
      fragmentShader: `uniform vec3 uColor; uniform float uIntensity, uFall; varying vec2 vUv;
        void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * uFall) * smoothstep(1.0, 0.65, d); gl_FragColor = vec4(uColor * a * uIntensity, 1.0); }`
    });
  }

  /* ---- structure */
  const floatRig = addToScene(new THREE.Group());             // bobbing + drift toward the cursor
  const leanRig = new THREE.Group(); floatRig.add(leanRig);   // tilt (mouse Y, lean, tumble)
  const spinRig = new THREE.Group(); leanRig.add(spinRig);    // yaw (mouse X, momentum, idle, bloom spin)
  const breathRig = new THREE.Group(); spinRig.add(breathRig);

  const shadowy = (m) => { m.castShadow = true; return m; };

  // glowing core
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), coreMat);
  core.scale.setScalar(G.core);
  breathRig.add(core);

  // liquid metal
  const blob = shadowy(new THREE.Mesh(new THREE.SphereGeometry(1, 144, 96), blobMat));
  blob.scale.setScalar(G.liquidMetal);
  breathRig.add(blob);

  // glass petals: a twisted bud of lens-shaped shards, each hinged at its lower tip
  const GP = G.petals, PETALS = GP.count;
  function petalGeometry(n) {
    const segU = GP.segU, segV = GP.segV, th0 = GP.top, th1 = Math.PI - GP.bottom;
    const half = (Math.PI / n) * GP.width, twist = GP.twist;
    const pos = [], idx = [];
    for (let j = 0; j <= segV; j++) {
      const w = j / segV, th = th0 + (th1 - th0) * w;
      const prof = 0.22 + 0.78 * Math.pow(Math.sin(Math.PI * w), 0.65);
      for (let i = 0; i <= segU; i++) {
        const u = i / segU * 2 - 1;
        const phi = u * half * prof + twist * (w - 1);
        const r = 1 + 0.075 * Math.sin(Math.PI * w) * (1 - u * u) + 0.1 * Math.pow(1 - w, 4) * (1 - 0.5 * u * u);
        pos.push(r * Math.sin(th) * Math.sin(phi), r * Math.cos(th), r * Math.sin(th) * Math.cos(phi));
      }
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + segU + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const petalGeo = petalGeometry(PETALS);
  const petalTip = new THREE.Vector3(0, Math.cos(Math.PI - GP.bottom), Math.sin(Math.PI - GP.bottom));
  const petals = [];
  for (let i = 0; i < PETALS; i++) {
    const arm = new THREE.Group(); arm.rotation.y = i / PETALS * TAU;
    const hinge = new THREE.Group(); hinge.position.copy(petalTip);
    const mesh = shadowy(new THREE.Mesh(petalGeo, glassMat)); mesh.position.copy(petalTip).negate();
    hinge.add(mesh); arm.add(hinge); breathRig.add(arm);
    petals.push({ hinge, seed: Math.random(), sgn: i % 2 ? 1 : -1 });
  }

  // porcelain calyx with a scalloped lip and a gold inlay band
  const calyx = new THREE.Group(); breathRig.add(calyx);
  {
    const prof = G.calyx.profile.map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(prof, 144);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), rr = Math.hypot(x, z), phi = Math.atan2(z, x);
      p.setY(i, p.getY(i) + G.calyx.scallop * Math.cos(phi * PETALS) * smooth(0.45, 0.678, rr));
    }
    g.computeVertexNormals();
    calyx.add(shadowy(new THREE.Mesh(g, porcelainMat)));
    const band = shadowy(new THREE.Mesh(new THREE.TorusGeometry(G.calyx.band.radius, 0.009, 10, 180), goldMat));
    band.rotation.x = Math.PI / 2; band.position.y = G.calyx.band.y; calyx.add(band);
    const knot = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 16), goldMat));
    knot.position.y = -1.3; calyx.add(knot);
  }

  // crown: porcelain bead with metal stamens tipped in light
  const crown = new THREE.Group(); crown.position.y = G.crown.y; breathRig.add(crown);
  {
    const bead = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.062, 32, 20), porcelainMat)); bead.scale.set(1, 0.85, 1); crown.add(bead);
    const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.007, 8, 48), goldMat)); ring.rotation.x = Math.PI / 2; crown.add(ring);
  }
  const TIP_COLORS = C.tips.map(c => color(THREE, c));
  const tendrils = [], GT = G.tendrils;
  for (let k = 0; k < GT.count; k++) {
    const arm = new THREE.Group(); arm.rotation.y = k / GT.count * TAU + 0.4;
    const pivot = new THREE.Group(); arm.add(pivot); crown.add(arm);
    const L = rand(GT.length[0], GT.length[1]), c = rand(GT.curl[0], GT.curl[1]);
    const pts = [[0, 0, 0], [0, 0.2, 0.03], [0, 0.45, 0.1], [0, 0.68, 0.22], [0, 0.86, 0.36], [0, 0.95, 0.5], [0, 0.93, 0.6], [0, 0.86, 0.64]]
      .map(([x, y, z]) => new THREE.Vector3(x, y * L, z * c * L));
    const curve = new THREE.CatmullRomCurve3(pts);
    pivot.add(shadowy(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.0085, 6, false), k % 2 ? goldMat : chromeMat)));
    const base = TIP_COLORS[k % 2];
    const tipMat = new THREE.MeshBasicMaterial({ color: base.clone() });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), tipMat);
    tip.position.copy(pts[pts.length - 1]); pivot.add(tip);
    tendrils.push({ pivot, tipMat, base, seed: Math.random() * 100 });
  }

  // kinetic rings: two gimballed hoops carrying porcelain and light beads
  const beadGeo = new THREE.SphereGeometry(1, 24, 16);
  function makeRing(radius, tube, mat, tiltX, tiltZ, beads) {
    const prec = new THREE.Group(), tilt = new THREE.Group(), carrier = new THREE.Group();
    tilt.rotation.set(tiltX, 0, tiltZ); prec.add(tilt); tilt.add(carrier);
    tilt.add(shadowy(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 260), mat)));
    for (const [ang, r, m] of beads) {
      const b = shadowy(new THREE.Mesh(beadGeo, m)); b.scale.setScalar(r);
      b.position.set(Math.cos(ang) * radius, Math.sin(ang) * radius, 0); carrier.add(b);
    }
    spinRig.add(prec);
    return { prec, tilt, carrier, tiltX };
  }
  const beadGlowA = new THREE.MeshBasicMaterial({ color: color(THREE, C.beadWarm) });
  const beadGlowB = new THREE.MeshBasicMaterial({ color: color(THREE, C.beadCool) });
  const metals = { chrome: chromeMat, gold: goldMat }, beadMats = { porcelain: porcelainMat, warm: beadGlowA, cool: beadGlowB };
  const [ringA, ringB] = G.rings.map(r =>
    makeRing(r.radius, r.tube, metals[r.metal], r.tilt[0], r.tilt[1], r.beads.map(([a, s, m]) => [a, s, beadMats[m]])));

  // pendant: a thread and a drop of liquid metal that swings on its own
  const pendant = new THREE.Group(); leanRig.add(pendant);
  const threadGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 1, 6); threadGeo.translate(0, -0.5, 0);
  const thread = new THREE.Mesh(threadGeo, goldMat); pendant.add(thread);
  const drop = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.07, 48, 32), chromeMat)); drop.scale.set(1, 1.3, 1); pendant.add(drop);
  const threadBead = shadowy(new THREE.Mesh(beadGeo, porcelainMat)); threadBead.scale.setScalar(0.022); pendant.add(threadBead);

  // light that lives outside the rigs (billboards)
  const coreGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial(color(THREE, C.coreGlow), 5.0));
  coreGlow.renderOrder = 10; addToScene(coreGlow);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial(color(THREE, C.halo), 3.0, true));
  halo.scale.setScalar(10); addToScene(halo);
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uColor: { value: color(THREE, C.shock) } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: UV_VERT,
    fragmentShader: `uniform float uP; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float w = 0.015 + 0.14 * uP;
        float ring = exp(-pow((d - uP) / w, 2.0)); float fade = (1.0 - uP) * (1.0 - uP);
        gl_FragColor = vec4(uColor * ring * fade * 2.2, 1.0); }`
  }));
  shock.scale.setScalar(BL.shockScale); shock.visible = false; shock.renderOrder = 11; addToScene(shock);

  // a soft beam falling from the spotlight onto the piece
  const beamGeo = new THREE.CylinderGeometry(0.22, 2.3, 10, 64, 1, true); beamGeo.translate(0, -5, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uIntensity: { value: 1 }, uColor: { value: color(THREE, C.beam) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vH = -position.y / 10.0; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uIntensity; uniform vec3 uColor; varying float vH; varying vec3 vN, vV, vW; ${NOISE}
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.8);
        float fall = smoothstep(0.0, 0.25, vH) * (1.0 - smoothstep(0.5, 1.0, vH));
        float n = laNoise(vW * 0.9 + vec3(0.0, -uTime * 0.08, uTime * 0.03)) * 0.5 + 0.5;
        gl_FragColor = vec4(uColor * f * fall * (0.5 + 0.5 * n) * uIntensity * 0.045, 1.0); }`
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.copy(spot.position);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), spot.target.position.clone().sub(spot.position).normalize());
  addToScene(beam);

  /* ---- motion state */
  const rotY = spring(), rotX = spring(), leanX = spring(), leanZ = spring(), shX = spring(), shY = spring(), pendX = spring(), pendZ = spring();
  let prox = 0, freeV = 0, freeA = 0, autoA = 0;
  let shiver = 0, ringKick = 0, pulse = 0;
  const tmpV = new THREE.Vector3(), coreW = new THREE.Vector3(), camDir = new THREE.Vector3(), dockW = new THREE.Vector3();
  const view = { open: 0, br: 0, intro: 0, heat: 0, pulse: 0, T };   // what the other modules read each frame
  const pieceCount = Math.min(PETALS, T.petals.length);

  /* ---- per frame: read the transition channels */
  function advance() { view.open = Math.max(0, T.open); }

  /* ---- surprises: the piece occasionally does something of its own. Returns a particle burst, if any. */
  function surprise() {
    const sgn = Math.random() < 0.5 ? -1 : 1;
    let burst = 0;
    switch (Math.floor(Math.random() * 5)) {
      case 0: rotY.v += sgn * rand(1.4, 2.4); leanX.v += rand(-0.6, 0.6); break;   // a glance
      case 1: shiver = 1; break;                                                    // petals flutter
      case 2: pulse = 1; burst = 0.7; break;                                         // a heartbeat
      case 3: ringKick = sgn * 2.6; break;                                           // rings realign
      case 4: pendZ.v += sgn * 2.2; pendX.v += rand(-1, 1); break;                  // the drop swings
    }
    return burst;
  }

  /* ---- motion: springs toward the cursor, momentum, idle float and breath */
  function updateMotion(dt, input, camera) {
    const { simT, sdt } = sim, hover = input.hover, engage = input.engage;
    shiver *= Math.exp(-2.2 * dt); ringKick *= Math.exp(-1.2 * dt); pulse *= Math.exp(-2.5 * dt);

    // where is the artifact on screen, and how close is the cursor?
    camera.updateMatrixWorld();
    floatRig.getWorldPosition(tmpV); tmpV.project(camera);
    if (!Number.isFinite(tmpV.x) || !Number.isFinite(tmpV.y)) tmpV.set(0, 0, 0);
    const ldx = (input.x - tmpV.x) * camera.aspect, ldy = input.y - tmpV.y, ld = Math.hypot(ldx, ldy) + 1e-4;
    prox = damp(prox, input.inside ? (1 - smooth(0.3, 1.35, ld)) : 0, 3, dt);
    const leanAmt = prox * smooth(0.04, 0.35, ld), nx = ldx / ld, ny = ldy / ld;

    // rotation: underdamped springs give weight and overshoot; flicks add free spin
    stepSpring(rotY, input.x * MO.turn.yaw * engage, 16, 4.2, dt);
    stepSpring(rotX, input.y * MO.turn.pitch * engage, 16, 4.6, dt);
    stepSpring(leanZ, -nx * MO.lean.roll * leanAmt, 22, 5.5, dt);
    stepSpring(leanX, -ny * MO.lean.pitch * leanAmt, 22, 5.5, dt);
    stepSpring(shX, nx * MO.lean.shiftX * leanAmt, 14, 5, dt);
    stepSpring(shY, ny * MO.lean.shiftY * leanAmt, 14, 5, dt);
    freeV += input.flickX * (device.reduced ? 0.25 : 0.75); rotX.v += input.flickY * 1.1; input.flickX = input.flickY = 0;
    freeV *= Math.exp(-1.35 * dt); freeA += freeV * dt;
    autoA += sdt * (device.reduced ? 0.05 : MO.spinIdle + MO.spinWander * noise1(simT * 0.07)) * (1 - MO.spinHoverSlow * hover);

    // idle life
    const floatAmp = device.reduced ? 0.4 : 1;
    const fy = (Math.sin(simT * 0.61) * MO.floatY[0] + Math.sin(simT * 0.23 + 1.3) * MO.floatY[1] + noise1(simT * 0.35 + 10) * MO.floatY[2]) * floatAmp;
    const fx = (Math.sin(simT * 0.29 + 0.7) * MO.floatX[0] + noise1(simT * 0.2 + 30) * MO.floatX[1]) * floatAmp;
    const br = Math.sin(simT * 0.85 + Math.sin(simT * 0.13) * 1.8);
    const intro = easeOutCubic(clamp(sim.clock / 4.2));

    floatRig.position.set(fx + shX.x, 0.02 + fy + shY.x - (1 - intro) * 0.35, 0);
    if (T.dock > 0) {
      // a point at the artifact's depth that sits at the top centre of the screen
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

  /* ---- parts: petals, core, liquid metal, crown, calyx, rings, pendant */
  function updateParts(dt, input) {
    const { clock, simT, sdt } = sim, hover = input.hover, open = view.open, br = view.br;

    for (let i = 0; i < pieceCount; i++) {
      const p = petals[i];
      const oi = T.petals[i].v + T.tease * 0.14 * (1 - i * 0.1);
      const wob = hover * HV.petalWobble * Math.sin(clock * 1.6 + p.seed * 20) + shiver * 0.07 * Math.sin(clock * 34 + i * 1.7) + br * 0.018;
      p.hinge.rotation.set(oi * 0.95 + wob, oi * 0.25 * p.sgn, oi * 0.38 * p.sgn);
      p.hinge.position.set(0, petalTip.y + Math.max(0, oi) * (0.12 + 0.22 * p.seed), petalTip.z + oi * (0.45 + 0.2 * p.seed));
    }

    const heat = hover + pulse * 0.6 + T.tease * 0.5;
    view.heat = heat; view.pulse = pulse;
    glassRim.uRim.value = 0.12 + heat * 0.25 + open * 1.1 + T.flash * 1.5;
    glassRim.uRimColor.value.setRGB(lerp(C.glassRim[0], C.glassRimOpen[0], open), lerp(C.glassRim[1], C.glassRimOpen[1], open), lerp(C.glassRim[2], C.glassRimOpen[2], open));
    core.scale.setScalar(G.core * (1 + open * 0.55 + T.flash * 0.25 + pulse * 0.1));
    coreMat.uniforms.uIntensity.value = 2.2 + heat * HV.coreHeat + open * 3.5 + T.flash * 8;
    BU.uTime.value += dt * (1 + hover * 1.2 + open * 2);
    BU.uAmp.value = 0.07 + hover * 0.04 + open * 0.12 + br * 0.01;
    BU.uHole.value = 0.3 - hover * 0.14 - open * 0.78 - pulse * 0.08;
    BU.uGlow.value = 0.45 + heat * 1.0 + open * 2.5 + T.flash * 4;
    blob.scale.setScalar(G.liquidMetal * (1 + br * 0.02 - open * 0.12 + hover * 0.02));
    blob.rotation.y += dt * 0.1 * (1 + hover * 2);

    crown.position.y = G.crown.y + open * 0.55;
    crown.rotation.y = -autoA * 0.4 + open * 1.2 + noise1(simT * 0.3 + 5) * 0.2 * hover;
    for (let k = 0; k < tendrils.length; k++) {
      const t = tendrils[k];
      const amp = 0.05 + hover * HV.tendrilSway;
      t.pivot.rotation.x = 0.1 + amp * noise1(simT * 0.5 + t.seed) + shiver * 0.08 * Math.sin(clock * 30 + k) + open * 0.75;
      t.pivot.rotation.z = amp * 0.8 * noise1(simT * 0.45 + t.seed + 100);
      t.tipMat.color.copy(t.base).multiplyScalar(1.4 + heat * 2 + open * 3 + T.flash * 4);
    }

    calyx.position.y = -open * 0.4 + Math.sin(simT * 0.9 + 1) * 0.008 * (1 + hover * 3);
    calyx.rotation.y = simT * 0.04 - open * 0.9;
    ringA.prec.rotation.y += sdt * (0.22 + hover * 0.8 + open * 2.6 + ringKick);
    ringA.carrier.rotation.z += sdt * (0.35 + hover * 1.4 + open * 2);
    ringA.tilt.rotation.x = ringA.tiltX + Math.sin(simT * 0.21) * 0.08 + open * 0.5;
    ringA.prec.scale.setScalar(1 + open * 0.28);
    ringB.prec.rotation.y -= sdt * (0.15 + hover * 0.6 + open * 1.8 + ringKick * 0.6);
    ringB.carrier.rotation.z -= sdt * (0.25 + hover * 1.1 + open * 1.5);
    ringB.tilt.rotation.x = ringB.tiltX + Math.sin(simT * 0.17 + 2) * 0.1 - open * 0.45;
    ringB.prec.scale.setScalar(1 + open * 0.42);
    beadGlowA.color.setRGB(C.beadWarm[0], C.beadWarm[1], C.beadWarm[2]).multiplyScalar(1 + heat * 0.8 + open * 1.5);
    beadGlowB.color.setRGB(C.beadCool[0], C.beadCool[1], C.beadCool[2]).multiplyScalar(1 + heat * 0.8 + open * 1.5);

    stepSpring(pendX, -leanRig.rotation.x, 9, 0.8, dt);
    stepSpring(pendZ, -leanRig.rotation.z, 9, 0.8, dt);
    const len = 0.22 + open * 0.3;
    pendant.position.y = (-1.3 - open * 0.4) * breathRig.scale.y;
    pendant.rotation.set(pendX.x, 0, pendZ.x);
    thread.scale.y = len; threadBead.position.y = -len * 0.55; drop.position.y = -(len + 0.09);
  }

  /* ---- light that follows the core: point light, billboards, the spotlight beam */
  function updateGlow(camera, input) {
    const open = view.open, heat = view.heat, hover = input.hover;
    core.getWorldPosition(coreW);
    coreLight.position.copy(coreW);
    coreLight.intensity = 0.9 + heat * 1.2 + open * 4.5 + T.flash * 16;
    coreGlow.position.copy(coreW); coreGlow.quaternion.copy(camera.quaternion);
    coreGlow.scale.setScalar(1.3 * (1 + open * 0.35 + T.flash * 0.5 + hover * 0.1));
    coreGlow.material.uniforms.uIntensity.value = 0.42 + heat * 0.35 + open * 0.3 + T.flash * 1.1;
    camera.getWorldDirection(camDir);
    halo.position.copy(coreW).addScaledVector(camDir, 2.5); halo.quaternion.copy(camera.quaternion);
    halo.material.uniforms.uIntensity.value = 0.05 + hover * 0.025 + open * 0.06 + T.flash * 0.12;
    beamMat.uniforms.uIntensity.value = 1 + open * 0.4 + T.flash * 0.8;
  }

  /* ---- transition events: burst, sparks and shockwave as the shell splits; an implosion as it snaps shut */
  let shockT = -1;
  function fireBurst(particles) {
    particles.F.burst = device.reduced ? BL.burstReduced : BL.burst;
    particles.spawnSparks(coreW.x, coreW.y, coreW.z, device.reduced ? BL.sparksReduced : BL.sparks);
    shockT = 0; shock.visible = true;
  }
  function fireSnap(particles) { particles.F.burst = BL.snap; }
  // a story line was absorbed: one small heartbeat and a brief inward swirl
  function absorb(particles) { pulse = Math.max(pulse, 0.6); particles.F.burst = BL.absorb; }
  function updateEffects(dt, camera) {
    if (shockT >= 0) {
      shockT += dt; const p = clamp(shockT / BL.shockTime);
      shock.material.uniforms.uP.value = easeOutCubic(p);
      shock.position.copy(coreW); shock.quaternion.copy(camera.quaternion);
      if (p >= 1) { shockT = -1; shock.visible = false; }
    }
  }

  // remove everything this species added and free its GPU resources
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

  return {
    config, group: floatRig, floatRig, view, T,
    materials: { glass: glassMat, chrome: chromeMat, gold: goldMat, porcelain: porcelainMat, liquidMetal: blobMat, core: coreMat },
    hoverRadius: () => 1.15 * floatRig.scale.x,
    advance, surprise, updateMotion, updateParts, updateGlow, updateEffects, fireBurst, fireSnap, absorb, dispose
  };
}
