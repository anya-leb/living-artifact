// Family materials shared by the gallery species: fresnel-rimmed glass, the glowing core,
// billboards for its glow and shockwave, and a liquid-metal skin. Prime keeps its own copies.
import * as THREE from 'three';
import { NOISE, UV_VERT, color } from './kit.js';

// Transmissive glass with a fresnel rim that the species brightens on hover and when it opens.
export function glassMaterial(spec, rimColor) {
  const mat = new THREE.MeshPhysicalMaterial({
    ...spec, attenuationColor: new THREE.Color(spec.attenuationColor ?? 0xffffff),
    side: THREE.DoubleSide, depthWrite: false
  });
  const rim = { uRim: { value: 0.1 }, uRimColor: { value: color(THREE, rimColor) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rim);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uRim; uniform vec3 uRimColor;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float laF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += uRimColor * laF * uRim;`);
  };
  mat.customProgramCacheKey = () => 'la-family-glass';
  return { mat, rim };
}

export const physical = (spec, extra = {}) => new THREE.MeshPhysicalMaterial({
  ...spec,
  ...(spec.sheenColor !== undefined ? { sheenColor: new THREE.Color(spec.sheenColor) } : {}),
  ...extra
});

// The glowing core: white-hot centre fading to the species' edge colour, with a slow boil.
export function coreMaterial(palette, U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uIntensity: { value: 2 }, uHot: { value: color(THREE, palette.coreHot) }, uEdge: { value: color(THREE, palette.coreEdge) } },
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
}

export function glowMaterial(col, falloff, depthTest = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: col }, uIntensity: { value: 1 }, uFall: { value: falloff } },
    transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending,
    vertexShader: UV_VERT,
    fragmentShader: `uniform vec3 uColor; uniform float uIntensity, uFall; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float a = exp(-d * d * uFall) * smoothstep(1.0, 0.65, d); gl_FragColor = vec4(uColor * a * uIntensity, 1.0); }`
  });
}

export function shockMaterial(col) {
  return new THREE.ShaderMaterial({
    uniforms: { uP: { value: 0 }, uColor: { value: col } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: UV_VERT,
    fragmentShader: `uniform float uP; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float d = length(vUv - 0.5) * 2.0; float w = 0.015 + 0.14 * uP;
        float ring = exp(-pow((d - uP) / w, 2.0)); float fade = (1.0 - uP) * (1.0 - uP);
        gl_FragColor = vec4(uColor * ring * fade * 2.2, 1.0); }`
  });
}

// Liquid metal skin on a unit sphere: a slow-boiling displaced surface. With `holes`, it opens
// into molten-edged gaps (uHole lower = more open), lit from inside by the core colour.
export function liquidMetalMaterial(spec, glowColor, { holes = true } = {}) {
  const u = {
    uTime: { value: 0 }, uAmp: { value: 0.07 }, uHole: { value: holes ? 0.34 : 9.0 },
    uGlow: { value: 0.5 }, uGlowColor: { value: color(THREE, glowColor) }
  };
  const mat = new THREE.MeshPhysicalMaterial({ ...spec, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
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
  mat.customProgramCacheKey = () => 'la-family-liquid-metal';
  return { mat, u };
}
