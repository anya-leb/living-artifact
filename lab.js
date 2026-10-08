// ?lab: every species side by side, each alive in its own cell, for judging the designs.
// One renderer, one canvas: each cell is its own scene + camera drawn into a scissored viewport,
// then one shared clamp → bloom → tone map → grain pass runs over the whole canvas.
// Hover a cell for its hover reaction; click (or Enter) to watch its bloom.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TAU, damp, rand, UV_VERT } from './lib/kit.js';
import { buildEnvironment } from './lib/environment.js';
import { createParticles } from './lib/particles.js';
import * as prime from './species/prime.js';
import * as tideBell from './species/tide-bell.js';
import * as clockworkSeed from './species/clockwork-seed.js';
import * as porcelainCrown from './species/porcelain-crown.js';
import * as staticGarden from './species/static-garden.js';

const SPECIES = [prime, tideBell, clockworkSeed, porcelainCrown, staticGarden];
const ROOM = 0x030407;

export function runLab({ renderer, device, U, sim }) {
  document.documentElement.classList.add('lab');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  const envTex = buildEnvironment(renderer);

  /* ---- page */
  const style = document.createElement('style');
  style.textContent = `
    html.lab,html.lab body{overflow-y:auto;height:auto}
    html.lab #placard,html.lab #site,html.lab #artifactBtn,html.lab #veil,html.lab .sr{display:none}
    .lab-wrap{position:relative;z-index:2;padding:72px 16px 56px;max-width:1500px;margin:0 auto;color:var(--mineral)}
    .lab-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;margin:0 0 28px}
    .lab-head h1{margin:0;font:400 italic clamp(26px,3vw,40px)/1 var(--font-head);font-variation-settings:"opsz" 144,"SOFT" 60}
    .lab-head p{margin:0;font:400 14px/1.5 var(--font-text);color:var(--mineral-dim);max-width:60ch}
    .lab-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:20px}
    .lab-cell{flex:0 1 min(100%,330px);display:grid;gap:10px;margin:0;cursor:pointer;outline:none}
    .lab-view{aspect-ratio:4/5;border:1px solid color-mix(in srgb,var(--mineral) 14%,transparent);position:relative}
    .lab-cell:focus-visible .lab-view{border-color:var(--frost)}
    .lab-cell figcaption{display:grid;gap:4px;font:400 13px/1.45 var(--font-text);color:var(--mineral-dim)}
    .lab-cell .no{font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;color:var(--mineral-dim)}
    .lab-cell .nm{font:400 22px/1.1 var(--font-head);font-variation-settings:"opsz" 72,"SOFT" 50;color:var(--mineral)}
    .lab-cell .sw{display:inline-flex;align-items:center;gap:8px;font:500 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em}
    .lab-cell .sw i{width:10px;height:10px;border-radius:50%;display:inline-block}
    #labFps{position:fixed;left:8px;top:8px;z-index:9;padding:6px 8px;background:rgba(0,0,0,.6);color:#9fd8ff;font:11px/1.3 ui-monospace,Menlo,monospace;white-space:pre}`;
  document.head.append(style);
  const wrap = document.createElement('main'); wrap.className = 'lab-wrap';
  wrap.innerHTML = `<header class="lab-head"><h1>The lab</h1>
    <p>Five species, each alive in its own cell. Hover a cell for its hover reaction. Click it to watch its bloom.</p></header>
    <div class="lab-grid"></div>`;
  document.body.append(wrap);
  const fpsEl = document.createElement('div'); fpsEl.id = 'labFps'; document.body.append(fpsEl);
  const grid = wrap.querySelector('.lab-grid');

  /* ---- cells */
  const cells = SPECIES.map((sp, idx) => {
    const cfg = sp.config;
    const el = document.createElement('figure'); el.className = 'lab-cell'; el.tabIndex = 0;
    el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${cfg.name}: play its bloom`);
    el.innerHTML = `<div class="lab-view"></div><figcaption><span class="no">No. ${String(idx + 1).padStart(2, '0')}</span>
      <span class="nm">${cfg.name}</span><span>${cfg.medium}</span>
      <span class="sw"><i style="background:${cfg.coreColor}"></i>${cfg.coreColor}</span></figcaption>`;
    grid.append(el);
    const view = el.querySelector('.lab-view');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM); scene.fog = new THREE.FogExp2(ROOM, 0.05);
    scene.environment = envTex;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.88, envMapIntensity: 0.06 }));
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

    const camera = new THREE.PerspectiveCamera(30, 0.8, 0.1, 60);
    const T = { open: 0, flash: 0, spin: 0, slow: 1, tilt: 0, dock: 0, warm: 0, tease: 0, petals: Array.from({ length: 5 }, () => ({ v: 0 })) };
    const ctx = { scene, spot, coreLight, U, sim, device, T, dock: { scale: 0.42, ndcY: 0.5 } };
    const art = sp.build(cfg, ctx);
    const particles = createParticles({ scene, palette: cfg.particles, U, sim, device, counts: { motes: 420, dust: 70, sparks: 180 } });
    const input = { x: 0, y: 0, inside: false, lastMove: -100, flickX: 0, flickY: 0, fieldReset: true, engage: 0.2, hover: 0, hit: false };
    const cell = { cfg, el, view, scene, camera, art, particles, input, T, tl: null, rect: null, onScreen: true, nextTwitch: rand(6, 14) };
    el.addEventListener('click', () => bloom(cell));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bloom(cell); } });
    return cell;
  });

  // a short bloom: split, flare, burst, a turn; hold; close with a click
  function bloom(c) {
    if (c.tl) return;
    const P = c.T.petals, T = c.T;
    c.tl = gsap.timeline({ paused: true, onComplete: () => { c.tl = null; } })
      .to(P, { v: -0.07, duration: 0.2, ease: 'sine.inOut', stagger: 0.035 }, 0)
      .to(P, { v: 1, duration: 1.0, ease: 'back.out(0.9)', stagger: 0.035 }, 0.2)
      .to(T, { open: 1, duration: 1.0, ease: 'back.out(0.9)' }, 0.2)
      .to(T, { flash: 1, duration: 0.1, ease: 'sine.in' }, 0.2).to(T, { flash: 0, duration: 0.3, ease: 'sine.out' }, 0.3)
      .call(() => c.art.fireBurst(c.particles), null, 0.27)
      .to(T, { spin: '+=' + TAU, duration: 1.7, ease: 'power2.inOut' }, 0.15)
      .to(P, { v: 0, duration: 0.8, ease: 'power3.inOut', stagger: { each: 0.03, from: 'end' } }, 2.4)
      .to(T, { open: 0, duration: 0.8, ease: 'power3.inOut' }, 2.4)
      .to(P, { v: -0.035, duration: 0.12, ease: 'sine.out' }, 3.32).to(P, { v: 0, duration: 0.2, ease: 'sine.inOut' }, 3.44)
      .call(() => c.art.fireSnap(c.particles), null, 3.32);
  }

  /* ---- pointer: each cell sees the cursor in its own viewport coordinates */
  let mx = -1, my = -1;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('pointerout', e => { if (!e.relatedTarget) mx = my = -1; });
  function updateInput(c, dt) {
    const r = c.rect, inp = c.input;
    const inside = mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
    if (inside) {
      const nx = (mx - r.left) / r.width * 2 - 1, ny = -((my - r.top) / r.height * 2 - 1);
      if (!inp.inside) inp.fieldReset = true; else { inp.flickX += nx - inp.x; inp.flickY += ny - inp.y; }
      if (nx !== inp.x || ny !== inp.y) inp.lastMove = sim.clock;
      inp.x = nx; inp.y = ny;
    }
    inp.inside = inside;
    const engT = inside ? (sim.clock - inp.lastMove < 1.3 ? 1 : 0.3) : 0.2;
    inp.engage = damp(inp.engage, engT, engT > inp.engage ? 3.5 : 0.45, dt);
    // hover = the cursor is over the piece itself (its silhouette's circle in the middle of the cell)
    inp.hit = inside && Math.hypot(inp.x * r.width / r.height, inp.y) < 0.62;
    inp.hover = damp(inp.hover, inp.hit ? 1 : 0, inp.hit ? 4 : 1.8, dt);
  }

  /* ---- post: one composer; the first pass draws every visible cell into its own viewport */
  class CellsPass extends Pass {
    constructor() { super(); this.needsSwap = false; }
    render(r, writeBuffer, readBuffer) {
      const rt = readBuffer;
      r.setRenderTarget(rt); r.setClearColor(ROOM, 1); r.clear();
      for (const c of cells) {
        if (!c.onScreen) continue;
        const b = c.rect, x = Math.round(b.left * dpr), y = Math.round((innerHeight - b.bottom) * dpr), w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
        rt.viewport.set(x, y, w, h); rt.scissor.set(x, y, w, h); rt.scissorTest = true;
        r.setRenderTarget(rt);
        r.render(c.scene, c.camera);
      }
      rt.viewport.set(0, 0, rt.width, rt.height); rt.scissorTest = false; r.setRenderTarget(rt);
    }
  }
  // No MSAA here: with a multisampled target, three.js resolves it while a cell's scissor is active,
  // so regions outside the last cell keep stale pixels and the additive bloom piles up there into white.
  const rt = new THREE.WebGLRenderTarget(innerWidth * dpr, innerHeight * dpr, { type: THREE.HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new CellsPass());
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } }, vertexShader: UV_VERT,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
        float l = max(max(c.r, c.g), c.b); c.rgb *= l > 8.0 ? 8.0 / l : 1.0; gl_FragColor = vec4(c.rgb, 1.0); }`
  }));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 1.0);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uRects: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uCount: { value: 0 }, uRoom: { value: new THREE.Vector3(3 / 255, 4 / 255, 7 / 255) } },
    vertexShader: UV_VERT,
    // glow stays inside the cells: everything outside them is the plain room colour
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform vec4 uRects[8]; uniform int uCount; uniform vec3 uRoom; varying vec2 vUv; // uRoom is display-referred (sRGB), like this pass's input
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 col = texture2D(tDiffuse, vUv).rgb;
        bool inside = false;
        for (int i = 0; i < 8; i++) { if (i >= uCount) break; vec4 r = uRects[i];
          if (vUv.x >= r.x && vUv.x <= r.z && vUv.y >= r.y && vUv.y <= r.w) inside = true; }
        if (!inside) col = uRoom;
        col += (hash(vUv * uRes + fract(uTime * 7.13) * 91.7) - 0.5) * 0.02; gl_FragColor = vec4(col, 1.0); }`
  });
  composer.addPass(grain);

  function resize() {
    renderer.setPixelRatio(dpr); renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(dpr); composer.setSize(innerWidth, innerHeight);
    grain.uniforms.uRes.value.set(innerWidth * dpr, innerHeight * dpr);
  }
  resize(); addEventListener('resize', resize);

  /* ---- loop */
  for (const c of cells) { c.rect = c.view.getBoundingClientRect(); renderer.compile(c.scene, c.camera); }
  let last = performance.now(), fpsT = 0, fpsN = 0;
  function tick(dt) {
    sim.clock += dt; sim.sdt = dt; sim.simT += dt;
    for (const c of cells) {
      c.rect = c.view.getBoundingClientRect();
      c.onScreen = c.rect.bottom > 0 && c.rect.top < innerHeight && c.rect.width > 0;
      if (!c.onScreen) continue;
      // frame the piece: fit its radius in the cell, both ways
      const aspect = c.rect.width / c.rect.height, half = Math.tan(THREE.MathUtils.degToRad(15));
      const R = c.cfg.geometry.frame || 1.75;
      c.camera.aspect = aspect; c.camera.updateProjectionMatrix();
      c.camera.position.set(c.input.x * 0.25 * c.input.engage, 0.3 + c.input.y * 0.35 * c.input.engage, Math.max(R / half, R / (half * aspect)) * 1.08);
      c.camera.lookAt(0, -0.05, 0);
      if (c.tl) c.tl.time(c.tl.time() + dt);
      updateInput(c, dt);
      c.T.tease = 0;
      if (!device.reduced && !c.tl && sim.clock > c.nextTwitch) {
        c.nextTwitch = sim.clock + rand(7, 17);
        const b = c.art.surprise(); if (b) c.particles.F.burst = b;
      }
      c.art.advance();
      c.art.updateMotion(dt, c.input, c.camera);
      c.art.updateParts(dt, c.input, c.camera);
      c.art.updateGlow(c.camera, c.input);
      c.art.updateEffects(dt, c.camera);
      c.particles.update(dt, c.input, c.camera, c.art);
      c.particles.syncUniforms(c.camera, c.art, c.rect.height * dpr);
      c.el.style.cursor = c.input.hit ? 'pointer' : 'default';
    }
    U.time.value = sim.clock;
    grain.uniforms.uTime.value = device.reduced ? 0 : sim.clock;
    let n = 0;
    for (const c of cells) if (c.onScreen && n < 8) {
      const b = c.rect; grain.uniforms.uRects.value[n++].set(b.left / innerWidth, 1 - b.bottom / innerHeight, b.right / innerWidth, 1 - b.top / innerHeight);
    }
    grain.uniforms.uCount.value = n;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.max(0, (now - last) / 1000); last = now;
    tick(Math.min(raw, 1 / 30));
    composer.render();
    fpsT += raw; fpsN++;
    if (fpsT > 0.5) { fpsEl.textContent = `lab  fps ${Math.round(fpsN / fpsT)}  dpr ${dpr}\n${cells.filter(c => c.onScreen).length} cells on screen`; fpsT = fpsN = 0; }
  }
  requestAnimationFrame(frame);
  window.LAB = { cells, composer, step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); composer.render(); } };
}
