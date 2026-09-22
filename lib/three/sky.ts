/**
 * Cielo de la historia: un triángulo a pantalla completa en el plano lejano con un shader
 * que funde cuatro paletas (noche · lluvia · amanecer · hora dorada), con el horizonte
 * luminoso de la identidad, estrellas que se apagan al amanecer y un grano de película sutil.
 */

import * as THREE from 'three'

/** [cénit, medio, horizonte, suelo] + resplandor. Colores de lib/bouquet/palette.ts. */
const PALETTES: readonly (readonly string[])[] = [
  ['#05071a', '#141a3a', '#3a2a5c', '#0b0816', '#6e5a9e'], // noche
  ['#141b2c', '#2a3850', '#56688a', '#10141e', '#8a9ab8'], // lluvia
  ['#2b1b3d', '#7a4a5c', '#e8a87c', '#1f1628', '#f7c59f'], // amanecer
  ['#1a1035', '#4a1f4e', '#f2a25c', '#1f1628', '#ffc46b'], // hora dorada
]

const toVec = (hex: string) => {
  const c = new THREE.Color(hex)
  return new THREE.Vector3(c.r, c.g, c.b)
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

const FRAG = /* glsl */ `
uniform vec3 uTop[4];
uniform vec3 uMid[4];
uniform vec3 uHorizon[4];
uniform vec3 uGround[4];
uniform vec3 uGlow[4];
uniform float uSky;
uniform float uTime;
uniform float uHorizonY;
uniform vec2 uAspect;
varying vec2 vUv;

vec3 pick(vec3 arr[4], float s) {
  // Paleta i y la siguiente, fundidas por la parte fraccionaria.
  int i = int(floor(s));
  vec3 a = i <= 0 ? arr[0] : i == 1 ? arr[1] : i == 2 ? arr[2] : arr[3];
  vec3 b = i <= 0 ? arr[1] : i == 1 ? arr[2] : arr[3];
  return mix(a, b, smoothstep(0.0, 1.0, fract(s)));
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float s = clamp(uSky, 0.0, 3.0);
  vec3 top = pick(uTop, s);
  vec3 mid = pick(uMid, s);
  vec3 hor = pick(uHorizon, s);
  vec3 gnd = pick(uGround, s);
  vec3 glow = pick(uGlow, s);

  float y = vUv.y;
  float h = uHorizonY;
  vec3 col;
  if (y > h) {
    float t = (y - h) / (1.0 - h);
    col = mix(hor, mid, smoothstep(0.0, 0.45, t));
    col = mix(col, top, smoothstep(0.35, 1.0, t));
  } else {
    col = mix(gnd, hor * 0.55, smoothstep(h - 0.12, h, y));
  }

  // Resplandor del horizonte, centrado: detrás del ramo.
  vec2 p = (vUv - vec2(0.5, h)) * uAspect;
  col += glow * 0.35 * exp(-dot(p * vec2(0.9, 4.0), p * vec2(0.9, 4.0)) * 2.2);

  // Estrellas: solo de noche y con lluvia tenue, arriba.
  float night = 1.0 - smoothstep(1.2, 2.4, s);
  // Estrellas redondas: un punto con posición aleatoria dentro de cada celda.
  vec2 g = vUv * uAspect * 90.0;
  vec2 cell = floor(g);
  vec2 center = vec2(hash(cell + 1.7), hash(cell + 9.2)) * 0.6 + 0.2;
  float dotMask = smoothstep(0.12, 0.0, length(fract(g) - center));
  float star = step(0.9965, hash(cell)) * dotMask * smoothstep(h + 0.05, 0.95, y);
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 3.1) * 40.0);
  col += vec3(1.0, 0.95, 0.85) * star * tw * night * 0.8;

  // Grano de película: ruido por píxel que cambia cada fotograma. Quita el aspecto
  // digital a los degradados (y evita las bandas) sin que se note como textura.
  float grain = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 419.0) - 0.5;
  col += grain * 0.03 * (0.6 + 0.4 * (1.0 - night));

  #ifdef FA_LINEAR
  col = pow(max(col, vec3(0.0)), vec3(2.2));
  #endif
  gl_FragColor = vec4(col, 1.0);
}
`

export type Sky = { mesh: THREE.Mesh; update: (sky: number, time: number, aspect: number) => void; dispose: () => void }

export function createSky(): Sky {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
  const column = (i: number) => PALETTES.map((p) => toVec(p[i] ?? '#000'))
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTop: { value: column(0) },
      uMid: { value: column(1) },
      uHorizon: { value: column(2) },
      uGround: { value: column(3) },
      uGlow: { value: column(4) },
      uSky: { value: 0 },
      uTime: { value: 0 },
      uHorizonY: { value: 0.38 },
      uAspect: { value: new THREE.Vector2(1, 1) },
    },
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return {
    mesh,
    update(sky, time, aspect) {
      const u = material.uniforms
      if (u.uSky) u.uSky.value = sky
      if (u.uTime) u.uTime.value = time
      if (u.uAspect) (u.uAspect.value as THREE.Vector2).set(Math.max(1, aspect), Math.max(1, 1 / aspect))
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
