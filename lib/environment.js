// The studio every piece is lit by: a black room with a ring light and a few soft strips,
// pre-filtered into an environment map so glass and metal have something to reflect.
import * as THREE from 'three';
import { UV_VERT } from './kit.js';

// Studio environment: a black room with a few softboxes, so metal and glass have something to reflect.
export function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x010102);
  // soft-edged emitters, so reflections read as feathered streaks instead of hard rectangles
  const softMat = (hex, power) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(hex).multiplyScalar(power) } },
    vertexShader: UV_VERT,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 q = abs(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.1, 1.0, q.x)) * (1.0 - smoothstep(0.55, 1.0, q.y));
        gl_FragColor = vec4(uColor * a, 1.0); }`
  });
  const strip = (w, h, hex, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), softMat(hex, power));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  const halo = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 12, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0dc).multiplyScalar(2.6) }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 8; env.add(halo);   // overhead ring light
  strip(0.9, 11, 0x9ad4ff, 2.4, [-7, 1, 1.5]);   // cool strip, left
  strip(0.9, 11, 0xffae80, 1.8, [7, 0.4, -2]);   // warm strip, right
  strip(12, 0.7, 0xffffff, 0.9, [0, -2.5, -8]);  // low horizon line behind
  strip(1.4, 5, 0xc6a2ff, 0.9, [4, 2, 7]);       // violet kicker, front
  strip(0.6, 3, 0xffffff, 1.2, [-3.5, -0.5, 7]); // thin front fill
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}
