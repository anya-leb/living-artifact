// Particles around a piece: orbiting motes, room dust and bloom sparks, plus the invisible
// cursor field that bends them. One instance per scene (the main stage, a lab cell, a gallery frame).
import * as THREE from 'three';
import { TAU, damp, rand, color } from './kit.js';

export function createParticles({ scene, palette, U, sim, device, counts }) {
  counts = counts || { motes: device.lite ? 700 : 1500, dust: device.lite ? 350 : 750, sparks: device.lite ? 220 : 460 };
  const PU = { uTime: U.time, uScale: { value: 1000 }, uFocus: { value: 7 }, uAperture: { value: 0.2 } };
  function pointsMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute float aSeed; attribute vec3 aColor; attribute float aAlpha;
        uniform float uTime, uScale, uFocus, uAperture;
        varying vec3 vColor; varying float vAlpha; varying float vBlur;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = max(-mv.z, 0.1);
          float coc = clamp(abs(depth - uFocus) * uAperture, 0.0, 1.0);   // circle of confusion -> depth of field
          float tw = 0.72 + 0.28 * sin(uTime * (1.3 + aSeed * 2.7) + aSeed * 61.0);
          float px = aSize * uScale / depth;
          float grow = 1.0 + coc * 5.0;
          float s = px * grow;
          gl_PointSize = clamp(s, 1.5, 110.0);
          vColor = aColor;
          vAlpha = aAlpha * tw * pow(grow, -1.35) * min(1.0, s / 1.5) * exp(-max(depth - 8.0, 0.0) * 0.06);
          vBlur = coc;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha; varying float vBlur;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0; float r2 = dot(c, c);
          if (r2 > 1.0) discard;
          float sharp = exp(-r2 * 7.0);
          float bokeh = smoothstep(1.0, 0.78, r2) * (0.45 + 0.55 * r2);
          float a = mix(sharp, bokeh * 0.8, smoothstep(0.12, 0.55, vBlur));
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`
    });
  }
  function makePoints(N) {
    const g = new THREE.BufferGeometry();
    return {
      N, g, pos: new Float32Array(N * 3), col: new Float32Array(N * 3), size: new Float32Array(N),
      seed: new Float32Array(N), alpha: new Float32Array(N), baseA: new Float32Array(N),
      off: new Float32Array(N * 3), vel: new Float32Array(N * 3), role: new Uint8Array(N), mult: new Float32Array(N)
    };
  }
  function finishPoints(S) {
    const g = S.g;
    g.setAttribute('position', new THREE.BufferAttribute(S.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(S.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(S.size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(S.seed, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(S.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(g, pointsMaterial()); pts.frustumCulled = false; scene.add(pts);
    S.points = pts;
    return S;
  }
  // roles: 0 warm, 1 cool, 2 pale, 3 accent. Each particle keeps its role and brightness so a new palette can recolour it.
  const ROLES = [color(THREE, palette.warm), color(THREE, palette.cool), color(THREE, palette.pale), color(THREE, palette.accent)];
  const pickRole = () => { const k = Math.random(); return k < 0.42 ? 0 : k < 0.78 ? 1 : k < 0.95 ? 2 : 3; };
  const paint = (S, i, role, m) => { const c = ROLES[role]; S.role[i] = role; S.mult[i] = m; S.col.set([c.r * m, c.g * m, c.b * m], i * 3); };

  // motes: orbit the artifact, half in a tilted disc, half in a loose shell
  function createMotes(N) {
    const S = makePoints(N);
    Object.assign(S, { r: new Float32Array(N), ph: new Float32Array(N), w: new Float32Array(N), wob: new Float32Array(N), a: new Float32Array(N * 3), b: new Float32Array(N * 3), spread: new Float32Array(N) });
    const n = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const bandN = new THREE.Vector3(0.22, 1, 0.1).normalize();
    for (let i = 0; i < N; i++) {
      const band = Math.random() < 0.5;
      const r = band ? rand(1.55, 2.15) : 1.3 + Math.pow(Math.random(), 1.7) * 1.9;
      if (band) n.copy(bandN).add(a.set(rand(-.05, .05), 0, rand(-.05, .05))).normalize(); else n.randomDirection();
      a.set(1, 0, 0); if (Math.abs(n.x) > 0.9) a.set(0, 0, 1);
      a.cross(n).normalize(); b.crossVectors(n, a).normalize();
      S.a.set([a.x, a.y, a.z], i * 3); S.b.set([b.x, b.y, b.z], i * 3);
      S.r[i] = r; S.ph[i] = Math.random() * TAU; S.w[i] = 0.34 / Math.pow(r, 1.5) * rand(0.7, 1.3);
      S.wob[i] = band ? 0.02 : 0.08 * Math.random(); S.spread[i] = Math.random();
      const role = pickRole(); paint(S, i, role, rand(0.5, 1.5));
      S.size[i] = (band ? rand(0.012, 0.022) : rand(0.01, 0.03)) * (Math.random() < 0.03 ? 2.6 : 1);
      S.seed[i] = Math.random(); S.alpha[i] = S.baseA[i] = rand(0.2, 0.7);
    }
    return finishPoints(S);
  }
  // dust: the air of the room, mostly out of focus
  function createDust(N) {
    const S = makePoints(N);
    Object.assign(S, { home: new Float32Array(N * 3), f: new Float32Array(N * 3), s: new Float32Array(N * 3) });
    for (let i = 0; i < N; i++) {
      let x, y, z;
      do { x = rand(-9, 9); y = rand(-2.2, 5); z = rand(-11, 5); } while (Math.hypot(x, y, z) < 1.8 || (z > 4 && Math.abs(x) < 1.2 && Math.abs(y) < 1.2));
      S.home.set([x, y, z], i * 3);
      S.f.set([rand(.5, 1.5), rand(.5, 1.5), rand(.5, 1.5)], i * 3);
      S.s.set([rand(0, TAU), rand(0, TAU), rand(0, TAU)], i * 3);
      const role = Math.random() < 0.7 ? 2 : Math.random() < 0.5 ? 1 : 0; paint(S, i, role, rand(0.3, 0.75));
      S.size[i] = rand(0.012, 0.04); S.seed[i] = Math.random(); S.alpha[i] = S.baseA[i] = rand(0.1, 0.42);
    }
    return finishPoints(S);
  }
  // sparks: only exist during a bloom
  function createSparks(N) {
    const S = makePoints(N);
    Object.assign(S, { life: new Float32Array(N), max: new Float32Array(N) });
    for (let i = 0; i < N; i++) {
      const role = Math.random() < 0.65 ? 0 : 2; paint(S, i, role, rand(2, 4));
      S.size[i] = rand(0.01, 0.028); S.seed[i] = Math.random(); S.baseA[i] = rand(0.5, 1); S.alpha[i] = 0;
      S.pos[i * 3 + 1] = -100;
    }
    return finishPoints(S);
  }
  const motes = createMotes(counts.motes);
  const dust = createDust(counts.dust);
  const sparks = createSparks(counts.sparks);

  // The invisible field the cursor drags through: repel, swirl around the pointer ray, and carry along.
  const F = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1, on: 0, rep: 1, swirl: 2.6, drag: 2.2, mvx: 0, mvy: 0, mvz: 0, cx: 0, cy: 0, cz: 0, burst: 0, open: 0, breath: 0, orbitMul: 1, scale: 1 };
  const FA = new Float32Array(3);
  function fieldAccel(px, py, pz, R) {
    FA[0] = FA[1] = FA[2] = 0;
    if (F.on < 0.001) return;
    const vx = px - F.ox, vy = py - F.oy, vz = pz - F.oz;
    const al = vx * F.dx + vy * F.dy + vz * F.dz;
    if (al <= 0) return;
    const qx = vx - F.dx * al, qy = vy - F.dy * al, qz = vz - F.dz * al;
    const RR = R * (0.6 + al * 0.07), d2 = qx * qx + qy * qy + qz * qz;
    if (d2 >= RR * RR) return;
    const d = Math.sqrt(d2) + 1e-4, f = 1 - d / RR, f2 = f * f * F.on;
    const nx = qx / d, ny = qy / d, nz = qz / d;
    const tx = F.dy * nz - F.dz * ny, ty = F.dz * nx - F.dx * nz, tz = F.dx * ny - F.dy * nx;
    const rep = F.rep * f2, sw = F.swirl * f2, dr = F.drag * f2;
    FA[0] = nx * rep + tx * sw + F.mvx * dr;
    FA[1] = ny * rep + ty * sw + F.mvy * dr;
    FA[2] = nz * rep + tz * sw + F.mvz * dr;
  }

  function updateMotes(S, dt) {
    const { N, pos, r, ph, w, a, b, off, vel, wob, spread } = S;
    const k = 3.2, fr = Math.exp(-2.6 * dt), burst = F.burst;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      ph[i] += w[i] * F.orbitMul * dt;
      const p = ph[i], rr = r[i] * (1 + F.breath * 0.035 + F.open * 0.4 * (0.4 + spread[i])) * F.scale;
      const c = Math.cos(p) * rr, s = Math.sin(p) * rr;
      const bx = F.cx + a[i3] * c + b[i3] * s;
      const by = F.cy + a[i3 + 1] * c + b[i3 + 1] * s + Math.sin(p * 3 + i) * wob[i];
      const bz = F.cz + a[i3 + 2] * c + b[i3 + 2] * s;
      let ox = off[i3], oy = off[i3 + 1], oz = off[i3 + 2], vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
      if (burst !== 0) {
        const dx = bx - F.cx, dy = by - F.cy, dz = bz - F.cz, d = Math.hypot(dx, dy, dz) + 1e-5;
        const m = burst * (0.5 + Math.random() * 0.9) / d;
        vx += dx * m; vy += dy * m; vz += dz * m;
      }
      fieldAccel(bx + ox, by + oy, bz + oz, 0.55);
      vx = (vx + (FA[0] - ox * k) * dt) * fr;
      vy = (vy + (FA[1] - oy * k) * dt) * fr;
      vz = (vz + (FA[2] - oz * k) * dt) * fr;
      ox += vx * dt; oy += vy * dt; oz += vz * dt;
      off[i3] = ox; off[i3 + 1] = oy; off[i3 + 2] = oz; vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] = bx + ox; pos[i3 + 1] = by + oy; pos[i3 + 2] = bz + oz;
    }
    S.g.attributes.position.needsUpdate = true;
  }
  function updateDust(S, dt, t) {
    const { N, pos, home, f, s, off, vel } = S;
    const k = 0.9, fr = Math.exp(-1.5 * dt), burst = F.burst;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const bx = home[i3] + Math.sin(t * 0.05 * f[i3] + s[i3]) * 0.6;
      const by = home[i3 + 1] + Math.sin(t * 0.07 * f[i3 + 1] + s[i3 + 1]) * 0.4;
      const bz = home[i3 + 2] + Math.cos(t * 0.045 * f[i3 + 2] + s[i3 + 2]) * 0.6;
      let ox = off[i3], oy = off[i3 + 1], oz = off[i3 + 2], vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
      if (burst !== 0) {
        const dx = bx - F.cx, dy = by - F.cy, dz = bz - F.cz, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) + 1e-5;
        const m = burst * 1.6 / (d * (1 + d2 * 0.25));
        vx += dx * m; vy += dy * m; vz += dz * m;
      }
      fieldAccel(bx + ox, by + oy, bz + oz, 0.8);
      vx = (vx + (FA[0] * 0.8 - ox * k) * dt) * fr;
      vy = (vy + (FA[1] * 0.8 - oy * k) * dt) * fr;
      vz = (vz + (FA[2] * 0.8 - oz * k) * dt) * fr;
      ox += vx * dt; oy += vy * dt; oz += vz * dt;
      off[i3] = ox; off[i3 + 1] = oy; off[i3 + 2] = oz; vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      pos[i3] = bx + ox; pos[i3 + 1] = by + oy; pos[i3 + 2] = bz + oz;
    }
    S.g.attributes.position.needsUpdate = true;
  }
  function spawnSparks(S, cx, cy, cz, strength) {
    const v = new THREE.Vector3();
    for (let i = 0; i < S.N; i++) {
      if (Math.random() > strength) continue;
      const i3 = i * 3; v.randomDirection();
      v.y *= 0.75;
      const sp = 1.4 + Math.pow(Math.random(), 2) * 5.2;
      S.pos[i3] = cx + v.x * 0.25; S.pos[i3 + 1] = cy + v.y * 0.25; S.pos[i3 + 2] = cz + v.z * 0.25;
      S.vel[i3] = v.x * sp; S.vel[i3 + 1] = v.y * sp; S.vel[i3 + 2] = v.z * sp;
      S.life[i] = S.max[i] = rand(1.1, 2.7);
    }
  }
  function updateSparks(S, dt) {
    const { N, pos, vel, life, max, alpha, baseA } = S;
    const fr = Math.exp(-1.7 * dt);
    let any = false;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; any = true; } continue; }
      any = true;
      const i3 = i * 3;
      life[i] -= dt;
      fieldAccel(pos[i3], pos[i3 + 1], pos[i3 + 2], 0.6);
      vel[i3] = (vel[i3] + FA[0] * dt) * fr;
      vel[i3 + 1] = (vel[i3 + 1] + (FA[1] + 0.18) * dt) * fr;
      vel[i3 + 2] = (vel[i3 + 2] + FA[2] * dt) * fr;
      pos[i3] += vel[i3] * dt; pos[i3 + 1] += vel[i3 + 1] * dt; pos[i3 + 2] += vel[i3 + 2] * dt;
      const l = Math.max(life[i], 0) / max[i];
      alpha[i] = baseA[i] * Math.pow(l, 1.4) * (0.75 + 0.25 * Math.sin(life[i] * 40 + i));
    }
    if (any) { S.g.attributes.position.needsUpdate = true; S.g.attributes.aAlpha.needsUpdate = true; }
  }

  /* ---- per frame: rebuild the cursor field in world space, then move every system */
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
  const tmpV = new THREE.Vector3(), camDir = new THREE.Vector3();
  const mouseW = new THREE.Vector3(), mousePrev = new THREE.Vector3(), mouseVel = new THREE.Vector3();
  let mouseSpeed = 0;

  function update(dt, input, camera, art) {
    const view = art.view;
    ndc.set(input.x, input.y); raycaster.setFromCamera(ndc, camera);
    const ray = raycaster.ray;
    F.ox = ray.origin.x; F.oy = ray.origin.y; F.oz = ray.origin.z;
    F.dx = ray.direction.x; F.dy = ray.direction.y; F.dz = ray.direction.z;
    camera.getWorldDirection(camDir);
    art.floatRig.getWorldPosition(tmpV);
    plane.setFromNormalAndCoplanarPoint(camDir, tmpV);
    if (ray.intersectPlane(plane, mouseW)) {
      if (input.fieldReset) { mousePrev.copy(mouseW); input.fieldReset = false; }
      tmpV.copy(mouseW).sub(mousePrev).divideScalar(Math.max(dt, 1e-3));
      if (tmpV.length() > 12) tmpV.setLength(12);
      mouseVel.lerp(tmpV, 1 - Math.exp(-dt * 12));
      mousePrev.copy(mouseW);
    }
    mouseSpeed = damp(mouseSpeed, mouseVel.length(), 6, dt);
    F.on = damp(F.on, input.inside ? (device.reduced ? 0.5 : 1) : 0, 4, dt);
    F.mvx = mouseVel.x; F.mvy = mouseVel.y; F.mvz = mouseVel.z;
    F.rep = 1.2 + Math.min(mouseSpeed, 4) * 0.75;
    art.floatRig.getWorldPosition(tmpV); F.cx = tmpV.x; F.cy = tmpV.y; F.cz = tmpV.z;
    F.open = view.open; F.breath = view.br; F.scale = art.floatRig.scale.x;
    F.orbitMul = (1 + input.hover * 1.6 + view.open * 2.5 + view.pulse) * view.T.slow * (device.reduced ? 0.5 : 1);

    updateMotes(motes, sim.sdt);
    updateDust(dust, sim.sdt, sim.simT);
    updateSparks(sparks, sim.sdt);
    F.burst = 0;
  }

  // depth of field focuses on the artifact; point sizes follow the drawing-buffer height of the view
  function syncUniforms(camera, art, heightPx) {
    PU.uFocus.value = camera.position.distanceTo(art.floatRig.position);
    PU.uScale.value = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }

  // leave a short-lived trail of sparks at a point (used by the gallery swap flight)
  let emitIdx = 0;
  const ev = new THREE.Vector3();
  function emit(x, y, z, n, speed = 0.35) {
    const S = sparks;
    for (let k = 0; k < n; k++) {
      const i = emitIdx = (emitIdx + 1) % S.N, i3 = i * 3;
      ev.randomDirection();
      S.pos[i3] = x + ev.x * 0.06; S.pos[i3 + 1] = y + ev.y * 0.06; S.pos[i3 + 2] = z + ev.z * 0.06;
      S.vel[i3] = ev.x * speed; S.vel[i3 + 1] = ev.y * speed; S.vel[i3 + 2] = ev.z * speed;
      S.life[i] = S.max[i] = rand(0.45, 1.0);
    }
  }

  // recolour every particle for a new species, keeping each one's role and brightness
  function setPalette(p) {
    [p.warm, p.cool, p.pale, p.accent].forEach((c, k) => ROLES[k].setRGB(c[0], c[1], c[2]));
    for (const S of [motes, dust, sparks]) {
      for (let i = 0; i < S.N; i++) paint(S, i, S.role[i], S.mult[i]);
      S.g.attributes.aColor.needsUpdate = true;
    }
  }

  return {
    F, update, syncUniforms, setPalette, emit,
    spawnSparks: (x, y, z, strength) => spawnSparks(sparks, x, y, z, strength),
    get mouseSpeed() { return mouseSpeed; }
  };
}
