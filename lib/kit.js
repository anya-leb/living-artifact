// Shared kit for the stage and every species: math helpers, motion springs and GLSL snippets.
// Pure helpers only. Runtime state (clock, device flags, scene) is passed to species through `ctx`.

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOutBack = (x, s = 1.2) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const noise1 = (() => {           // smooth 1D value noise, for motion that never quite repeats
  const P = new Float32Array(512); for (let i = 0; i < 512; i++) P[i] = Math.random() * 2 - 1;
  return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(P[i & 511], P[(i + 1) & 511], u); };
})();
export const spring = () => ({ x: 0, v: 0 });
export const stepSpring = (s, target, k, c, dt) => { s.v += (k * (target - s.x) - c * s.v) * dt; s.x += s.v * dt; };

export const NOISE = /* glsl */`
vec3 laMod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 laMod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 laPermute(vec4 x){ return laMod289(((x*34.0)+1.0)*x); }
vec4 laTaylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float laNoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = laMod289(i);
  vec4 p = laPermute(laPermute(laPermute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 q0 = vec3(a0.xy, h.x);
  vec3 q1 = vec3(a0.zw, h.y);
  vec3 q2 = vec3(a1.xy, h.z);
  vec3 q3 = vec3(a1.zw, h.w);
  vec4 norm = laTaylorInvSqrt(vec4(dot(q0,q0), dot(q1,q1), dot(q2,q2), dot(q3,q3)));
  q0 *= norm.x; q1 *= norm.y; q2 *= norm.z; q3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(q0,x0), dot(q1,x1), dot(q2,x2), dot(q3,x3)));
}`;

export const UV_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// [r, g, b] (linear, may exceed 1 for glow) or a hex number -> THREE.Color
export const color = (THREE, c) => Array.isArray(c) ? new THREE.Color(c[0], c[1], c[2]) : new THREE.Color(c);

// A small seeded random generator (mulberry32), and a way to run code with Math.random swapped for it.
// Gallery frames build and animate under their own generator so they never disturb the main stage's sequence.
export const seeded = (seed) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export function withRandom(rng, fn) {
  const saved = Math.random; Math.random = rng;
  try { return fn(); } finally { Math.random = saved; }
}
