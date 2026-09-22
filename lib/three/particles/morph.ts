/**
 * El sistema de partículas de la historia: un único THREE.Points cuyo vertex shader mezcla
 * la forma del capítulo anterior (A) con la actual (B). Las formas viven en texturas float
 * (posición + tipo de movimiento; color + tamaño), así cambiar de capítulo no cuesta nada
 * en la CPU: solo se cambian dos texturas y una mezcla.
 */

import * as THREE from 'three'
import { SIMPLEX_3D } from './glsl'
import { GROUND, type Shape } from './shapes'

/** Máximo de flores del ramo (uniform array del shader). */
export const MAX_BOUQUET = 24

const VERT = /* glsl */ `
uniform sampler2D uPosA;
uniform sampler2D uColA;
uniform sampler2D uPosB;
uniform sampler2D uColB;
uniform float uMix;
uniform float uTime;
uniform float uTurb;
uniform sampler2D uPosTo;
uniform float uLift[${MAX_BOUQUET}];
uniform float uWind;
uniform float uSize;
uniform float uPixelRatio;
uniform float uFocus;
uniform float uCrisp;
uniform float uFade;
uniform float uVelocity;

attribute vec2 aRef;
attribute vec4 aRand;
attribute float aFlower;

varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
varying float vStreak;

${SIMPLEX_3D}

const float TAU = 6.28318530718;
const float GROUND_Y = ${GROUND.toFixed(2)};

vec3 animate(vec4 p) {
  float m = p.w;
  vec3 q = p.xyz;
  if (m < 0.5) {
    // quieto: respira un poco (nada cuando dibuja el ramo: tiene que leerse nítido)
    q += 0.035 * (1.0 - uCrisp) * vec3(sin(uTime * 0.8 + aRand.y * TAU), cos(uTime * 0.7 + aRand.y * 5.0), sin(uTime * 0.5 + aRand.x * TAU));
  } else if (m < 1.5) {
    // lluvia: cae en diagonal y reaparece arriba
    q.y = mod(q.y - uTime * (6.0 + aRand.z * 3.0) + 6.0, 14.0) - 6.0;
    q.x += q.y * 0.18;
  } else if (m < 2.5) {
    // motas que suben con vaivén
    q.y = mod(q.y + uTime * (0.35 + aRand.z * 0.3) + 6.0, 14.0) - 6.0;
    q.x += sin(uTime * 0.6 + aRand.y * TAU) * 0.3;
  } else {
    // órbita alrededor del eje vertical que pasa por la semilla
    float a = uTime * 0.9;
    q.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * q.xz;
  }
  // Viento: mece más lo que está más alto sobre el suelo.
  float h = max(0.0, q.y - GROUND_Y);
  q.x += sin(uTime * 1.3 + q.x * 0.35 + q.z * 0.2) * uWind * h * 0.06;
  q.z += cos(uTime * 1.1 + q.x * 0.25) * uWind * h * 0.025;
  return q;
}

void main() {
  vec4 pa = texture2D(uPosA, aRef);
  vec4 ca = texture2D(uColA, aRef);
  vec4 pb = texture2D(uPosB, aRef);
  vec4 cb = texture2D(uColB, aRef);

  // Cada partícula empieza su viaje con un pequeño retraso: la forma se deshace y se rehace.
  float d = aRand.x * 0.4;
  float m = smoothstep(d, d + 0.6, uMix);

  vec3 A = animate(pa);
  vec3 B = animate(pb);
  vec3 pos;

  pos = mix(A, B, m);

  // El ramo flor a flor: las partículas de cada flor elegida vuelan en arco desde el jardín
  // hasta su punto en el ramo 3D. Cada partícula lleva un pequeño retraso: la flor viaja
  // como un cometa con su estela.
  float lift = 0.0;
  if (aFlower > -0.5) {
    int k = int(aFlower + 0.5);
    float raw = uLift[k];
    lift = smoothstep(aRand.x * 0.18, aRand.x * 0.18 + 0.82, raw);
    if (lift > 0.0) {
      vec3 target = texture2D(uPosTo, aRef).xyz;
      vec3 ctrl = mix(pos, target, 0.5) + vec3(0.0, 2.2 + distance(pos, target) * 0.25, 0.0);
      float u = lift;
      vec3 arc = (1.0 - u) * (1.0 - u) * pos + 2.0 * (1.0 - u) * u * ctrl + u * u * target;
      arc += swirl(arc * 0.6 + uTime * 0.2) * 0.25 * sin(u * 3.14159);
      pos = arc;
    }
  }
  // Turbulencia: fuerte a mitad del viaje, nula al llegar (y nada en las que vuelan).
  float turb = uTurb * (0.35 + 0.65 * sin(m * 3.14159)) * (1.0 - step(0.001, lift));
  if (turb > 0.001) pos += swirl(pos * 0.28 + uTime * 0.06) * turb;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float depth = -mv.z;
  gl_Position = projectionMatrix * mv;

  // Profundidad de campo: lejos del plano de enfoque, más grande, difuso y tenue.
  float crisp = uCrisp * m;
  // Suave: el jardín del fondo tiene que seguir leyéndose como flores, no como nubes.
  vSoft = clamp(abs(depth - uFocus) * 0.035, 0.0, 0.65) * (1.0 - crisp);
  float size = mix(ca.w, cb.w, m) * (0.8 + aRand.z * 0.4) * mix(1.0, 0.62, crisp);
  // Con tope: una partícula junto a la cámara no se convierte en un disco que tapa la escena.
  gl_PointSize = min(uSize * size * (10.0 / depth) * (1.0 + vSoft * 1.6), 22.0) * uPixelRatio;

  // Gotas de lluvia: el fragment shader las estira en un trazo vertical.
  vStreak = mix(pa.w > 0.5 && pa.w < 1.5 ? 1.0 : 0.0, pb.w > 0.5 && pb.w < 1.5 ? 1.0 : 0.0, m);
  gl_PointSize *= 1.0 + vStreak * 1.5;
  vColor = mix(ca.rgb, cb.rgb, m);
  float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aRand.y * TAU);
  vAlpha = twinkle / (1.0 + vSoft * 2.2);
  // Densas y aditivas se queman a blanco: al dibujar el ramo cada punto aporta menos.
  vAlpha *= mix(1.0, 0.72, crisp);
  // En vuelo brillan más (son luz viajando); al aterrizar se apagan y la flor 3D toma el
  // relevo, salvo un 12 % que queda como destellos.
  vAlpha *= 1.0 + sin(lift * 3.14159) * 0.8;
  vAlpha *= 1.0 - smoothstep(0.86, 1.0, lift) * (aRand.y > 0.12 ? 0.96 : 0.5);
  // Cuando el ramo se hace real, las partículas de los cometas desaparecen del todo (si no,
  // al rodear el ramo pasarían junto a la cámara como discos enormes).
  if (aFlower > -0.5) vAlpha *= 1.0 - uFade;
  // Al hacer scroll rápido el jardín "respira": un pulso de brillo que se apaga al parar.
  vAlpha *= 1.0 + uVelocity * 0.35;
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
varying float vStreak;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // Trazo inclinado como la lluvia (cae en diagonal): se estrecha en x.
  vec2 rain = vec2(c.x + c.y * 0.18, c.y) * vec2(5.0, 1.0);
  float d = length(mix(c, rain, vStreak)) * 2.0;
  if (d > 1.0) discard;
  float edge = mix(0.55, 0.0, vSoft);
  float a = vAlpha * (1.0 - smoothstep(edge, 1.0, d));
  vec3 outColor = vColor;
  #ifdef FA_LINEAR
  outColor = pow(outColor, vec3(2.2));
  #endif
  gl_FragColor = vec4(outColor * a, a);
}
`

/** Empaqueta una forma en dos texturas float cuadradas. */
function toTextures(shape: Shape, side: number): [THREE.DataTexture, THREE.DataTexture] {
  const make = (src: Float32Array) => {
    const data = new Float32Array(side * side * 4)
    data.set(src.subarray(0, Math.min(src.length, data.length)))
    const tex = new THREE.DataTexture(data, side, side, THREE.RGBAFormat, THREE.FloatType)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return tex
  }
  return [make(shape.pos), make(shape.col)]
}

export type MorphParticles = {
  points: THREE.Points
  material: THREE.ShaderMaterial
  /** Registra o sustituye la forma de un capítulo. */
  setShape: (index: number, shape: Shape) => void
  /** Elige las formas de origen y destino. */
  use: (from: number, to: number) => void
  /** Destino de cada partícula en el ramo (solo cuentan las de las flores elegidas). */
  setBouquetTargets: (pos: Float32Array) => void
  dispose: () => void
}

export function createMorphParticles(count: number, shapeCount: number, seed: number, membership: Float32Array): MorphParticles {
  const side = Math.ceil(Math.sqrt(count))
  const geometry = new THREE.BufferGeometry()
  const ref = new Float32Array(count * 2)
  const rand = new Float32Array(count * 4)
  // PRNG pequeño y determinista para los atributos por partícula.
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = 0; i < count; i++) {
    ref[i * 2] = ((i % side) + 0.5) / side
    ref[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side
    rand[i * 4] = next()
    rand[i * 4 + 1] = next()
    rand[i * 4 + 2] = next()
    rand[i * 4 + 3] = next()
  }
  geometry.setAttribute('aRef', new THREE.BufferAttribute(ref, 2))
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4))
  geometry.setAttribute('aFlower', new THREE.BufferAttribute(membership, 1))
  // La posición real sale de las texturas; esta solo existe para que Three.js dibuje N puntos.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))

  const empty = toTextures({ pos: new Float32Array(count * 4), col: new Float32Array(count * 4) }, side)
  const textures: [THREE.DataTexture, THREE.DataTexture][] = Array.from({ length: shapeCount }, () => empty)

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uPosA: { value: empty[0] },
      uColA: { value: empty[1] },
      uPosB: { value: empty[0] },
      uColB: { value: empty[1] },
      uMix: { value: 1 },
      uTime: { value: 0 },
      uTurb: { value: 0.2 },
      uPosTo: { value: empty[0] },
      uLift: { value: new Array<number>(MAX_BOUQUET).fill(0) },
      uWind: { value: 0.3 },
      uVelocity: { value: 0 },
      uSize: { value: 2.6 },
      uPixelRatio: { value: 1 },
      uFocus: { value: 12 },
      uCrisp: { value: 0 },
      uFade: { value: 0 },
    },
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false

  return {
    points,
    material,
    setShape(index, shape) {
      const old = textures[index]
      if (old && old !== empty) {
        old[0].dispose()
        old[1].dispose()
      }
      textures[index] = toTextures(shape, side)
    },
    setBouquetTargets(pos) {
      const [tex] = toTextures({ pos, col: new Float32Array(pos.length) }, side)
      const u = material.uniforms.uPosTo
      if (u) {
        if (u.value !== empty[0]) (u.value as THREE.DataTexture).dispose()
        u.value = tex
      }
    },
    use(from, to) {
      const a = textures[from] ?? empty
      const b = textures[to] ?? empty
      const u = material.uniforms
      if (u.uPosA) u.uPosA.value = a[0]
      if (u.uColA) u.uColA.value = a[1]
      if (u.uPosB) u.uPosB.value = b[0]
      if (u.uColB) u.uColB.value = b[1]
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      for (const t of new Set(textures)) {
        t[0].dispose()
        t[1].dispose()
      }
    },
  }
}
