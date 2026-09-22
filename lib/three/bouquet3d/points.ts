/**
 * El ramo hecho de luz: nubes de puntos muestreadas de la superficie del molde 3D (que no
 * se dibuja). Cada punto lleva color y normal: se ilumina según su orientación (volumen)
 * y los bordes brillan más, a contraluz. Los puntos cuelgan del grupo de cada flor, así el
 * viento y el giro de 360° los mueven con ella.
 *
 * `uReveal` (0–1) enciende los puntos: llegan desde fuera, a lo largo de su normal, con un
 * destello; el orden de encendido es aleatorio por punto.
 *
 * Ya encendido, el ramo fluye: los pétalos respiran (a lo largo de su normal), una corriente
 * suave recorre la superficie y un 14 % de los puntos se desprende como polen dorado que sube
 * en espiral, se apaga y vuelve a nacer en su sitio (ciclo continuo, sin CPU).
 */

import * as THREE from 'three'
import type { Samples } from './build'

const VERT = /* glsl */ `
// position y normal ya los declara Three.js en los ShaderMaterial.
attribute vec3 color;
attribute vec2 aRand;
uniform float uReveal;
uniform float uTime;
uniform float uPixelRatio;
uniform float uWorldSize;
uniform float uViewScale;
uniform float uSolid;
varying vec3 vColor;
varying float vAlpha;

void main() {
  // Encendido: cada punto tiene su umbral; al aparecer viene desde fuera y destella.
  float t = uReveal >= 0.999 ? 1.0 : clamp((uReveal - aRand.x * 0.8) / 0.2, 0.0, 1.0);
  // Una normal nula daría NaN; con bloom, un NaN se difumina en una mancha negra.
  vec3 nv = normalMatrix * normal;
  vec3 n = dot(nv, nv) > 1e-8 ? normalize(nv) : vec3(0.0, 0.0, 1.0);
  vec3 p = position + normal * (1.0 - t) * 0.35;
  float full = step(0.999, uReveal);
  // Respiración de los pétalos y corriente suave que recorre la flor.
  float ph = uTime * 1.2 + aRand.y * 6.2832;
  p += normal * sin(ph + position.y * 3.0) * 0.014 * full;
  p += vec3(
    sin(position.y * 4.0 + uTime * 0.9 + aRand.x * 3.0),
    sin(position.z * 3.5 + uTime * 1.1),
    cos(position.x * 3.8 + uTime * 0.8)
  ) * 0.014 * full;
  // Polen que fluye: se separa, sube en espiral y se desvanece; luego renace en la flor.
  float stream = step(0.86, aRand.x) * full;
  float life = fract(uTime * 0.08 + aRand.y * 13.0);
  vec3 swirl = vec3(sin(life * 6.0 + aRand.y * 20.0), 0.0, cos(life * 5.0 + aRand.y * 17.0));
  p += stream * (normal * 0.5 + vec3(0.0, 0.9, 0.0) + swirl * 0.5) * life * life * 1.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;

  // Tamaño en unidades del mundo: de cerca crece y la flor se sigue leyendo.
  // uViewScale = píxeles por unidad a distancia 1 (alto de pantalla / 2·tan(fov/2)).
  // Con tope: de muy cerca los puntos no se vuelven discos; la flor se ve como una
  // constelación nítida.
  gl_PointSize = min(uWorldSize * uViewScale / max(0.2, depth), 7.0) * uPixelRatio * (0.8 + aRand.y * 0.4);

  // Luz que sigue a la cámara (desde arriba a la izquierda) + contraluz en los bordes.
  vec3 light = normalize(vec3(-0.4, 0.6, 0.7));
  float diffuse = 0.45 + 0.55 * abs(dot(n, light));
  float rim = pow(1.0 - abs(n.z), 2.0) * 0.3;
  float twinkle = 0.88 + 0.12 * sin(uTime * 2.5 + aRand.y * 40.0);
  // El disco del girasol se queda oscuro (marrón tenue): es lo que hace que se lea como
  // girasol. Solo se calienta un poco para que no desaparezca del todo.
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 base = mix(color, vec3(0.55, 0.28, 0.08), 0.35 * (1.0 - smoothstep(0.15, 0.5, luma)));
  // Los puntos sólidos llevan menos brillo de borde: el color del girasol, saturado.
  vColor = base * diffuse + vec3(1.0, 0.86, 0.55) * rim * (1.0 - uSolid * 0.7);
  vAlpha = t * twinkle * (1.0 + (1.0 - t) * 2.0);
  // El polen es dorado y se apaga al final de su vuelo.
  vColor = mix(vColor, vec3(1.0, 0.82, 0.4), stream * life);
  vAlpha *= mix(1.0, sin(life * 3.14159) * 1.3, stream);
  // Puntos sólidos (con profundidad): no hay transparencia, así que aparecer y apagarse se
  // hace con el tamaño.
  if (uSolid > 0.5) {
    gl_PointSize *= clamp(vAlpha, 0.0, 1.0);
    vAlpha = 1.0;
  }
}
`

const FRAG = /* glsl */ `
uniform float uAlpha;
uniform float uSolid;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vAlpha <= 0.001) discard;
  vec3 outColor = max(vColor, vec3(0.0));
  #ifdef FA_LINEAR
  outColor = pow(outColor, vec3(2.2));
  #endif
  if (uSolid > 0.5) {
    // Punto opaco, con un leve sombreado hacia el borde (parece una gota de luz).
    gl_FragColor = vec4(outColor * (1.0 - 0.35 * d * d) * uAlpha, 1.0);
    return;
  }
  float a = vAlpha * uAlpha * (1.0 - smoothstep(0.45, 1.0, d));
  gl_FragColor = vec4(outColor * a, a);
}
`

export type LightPoints = { points: THREE.Points; material: THREE.ShaderMaterial }

/** Convierte muestras en coordenadas de mundo en una nube colgada de `parent`. */
/**
 * `solid`: puntos opacos con profundidad (las flores de delante tapan lo de detrás y cada
 * girasol se lee); si no, luz aditiva translúcida (el papel).
 */
export function createLightPoints(samples: Samples, count: number, parent: THREE.Object3D, alpha: number, worldSize: number, seed: number, solid = false): LightPoints {
  parent.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const invNormal = new THREE.Matrix3().getNormalMatrix(inv)
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const nor = new Float32Array(count * 3)
  const rand = new Float32Array(count * 2)
  const v = new THREE.Vector3()
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = 0; i < count; i++) {
    v.set(samples.pos[i * 4] ?? 0, samples.pos[i * 4 + 1] ?? 0, samples.pos[i * 4 + 2] ?? 0).applyMatrix4(inv)
    pos.set([v.x, v.y, v.z], i * 3)
    col.set([samples.col[i * 4] ?? 1, samples.col[i * 4 + 1] ?? 1, samples.col[i * 4 + 2] ?? 1], i * 3)
    v.set(samples.nor[i * 3] ?? 0, samples.nor[i * 3 + 1] ?? 0, samples.nor[i * 3 + 2] ?? 1).applyMatrix3(invNormal).normalize()
    nor.set([v.x, v.y, v.z], i * 3)
    rand[i * 2] = next()
    rand[i * 2 + 1] = next()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 2))
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    ...(solid
      ? { transparent: false, depthWrite: true, blending: THREE.NormalBlending }
      : { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor }),
    uniforms: {
      uSolid: { value: solid ? 1 : 0 },
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uWorldSize: { value: worldSize },
      uViewScale: { value: 1000 },
      uAlpha: { value: alpha },
    },
  })
  material.userData.alpha = alpha
  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  parent.add(points)
  return { points, material }
}
