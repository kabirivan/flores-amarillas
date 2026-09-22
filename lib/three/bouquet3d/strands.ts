/**
 * El ramo hecho de líneas que fluyen (estilo «blend»: cientos de hilos finos y translúcidos
 * que forman cintas que se retuercen y ondulan).
 *
 * - Tallo: una cinta de hilos verdes que gira sobre sí misma mientras sube.
 * - Pétalos: haces de hilos dorados que se abren desde el disco y se cierran en la punta.
 * - Disco: doble espiral de hilos oscuros (el dibujo de las semillas del girasol).
 * - Hojas y papel: más hilos; el papel, dos familias de hélices que se cruzan (tejido).
 *
 * Todo es geometría estática (LineSegments); el movimiento va en el shader: cada hilo ondula
 * en su dirección `aWob`, un pulso de luz lo recorre, y `uReveal` lo dibuja desde su origen
 * hasta su punta (la flor se «traza» al llegar). Se dibuja con mezcla aditiva: donde se
 * cruzan muchos hilos, la cinta se ve densa, como en la referencia.
 */

import * as THREE from 'three'

const VERT = /* glsl */ `
attribute float aT;
attribute float aSeed;
attribute vec3 aWob;
attribute vec3 color;
attribute float aFill;
uniform float uReveal;
uniform float uTime;
uniform float uAlpha;
varying vec3 vColor;
varying float vA;
void main() {
  // Ondulación que viaja a lo largo del hilo (fluye de la base a la punta).
  float wave = sin(aT * 7.0 - uTime * 1.6 + aSeed * 6.2832);
  vec3 p = position + aWob * wave;
  // Trazado: cada hilo se dibuja desde su origen; los hilos arrancan escalonados.
  float grow = smoothstep(0.0, 0.06, uReveal * 1.3 - aT - aSeed * 0.3);
  // Pulso de luz que recorre el hilo.
  float pulse = 0.6 + 0.4 * sin(aT * 9.0 - uTime * 2.2 + aSeed * 12.0);
  // El velo entre hilos (aFill = 1) es mucho más tenue que los hilos.
  vA = grow * uAlpha * mix(pulse, 0.16, aFill);
  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  if (vA <= 0.002) discard;
  vec3 c = vColor;
  #ifdef FA_LINEAR
  c = pow(c, vec3(2.2));
  #endif
  gl_FragColor = vec4(c * vA, vA);
}
`

/**
 * Un hilo: puntos, color (uno o uno por punto) y dirección/amplitud de su ondulación.
 * `sheet`: los hilos seguidos con el mismo `sheet` (y mismo número de puntos) forman una
 * cinta; entre ellos se tiende un velo translúcido que da algo de cuerpo.
 */
export type Strand = { points: THREE.Vector3[]; colors: THREE.Color[]; wob: THREE.Vector3; seed: number; sheet?: number }

export type Strands = { points: THREE.LineSegments; material: THREE.ShaderMaterial }

let sheetId = 0
/** Un identificador de cinta nuevo (para agrupar hilos en un velo). */
const nextSheet = () => ++sheetId

/** Junta los hilos en un solo LineSegments (una llamada de dibujo) colgado de `parent`. */
export function createStrands(strands: Strand[], parent: THREE.Object3D, alpha: number): Strands {
  let segs = 0
  for (const s of strands) segs += Math.max(0, s.points.length - 1)
  const pos = new Float32Array(segs * 6)
  const col = new Float32Array(segs * 6)
  const wob = new Float32Array(segs * 6)
  const t = new Float32Array(segs * 2)
  const seed = new Float32Array(segs * 2)
  let v = 0
  for (const s of strands) {
    const n = s.points.length
    const put = (i: number) => {
      const p = s.points[i]!
      const c = s.colors[Math.min(i, s.colors.length - 1)]!
      pos.set([p.x, p.y, p.z], v * 3)
      col.set([c.r, c.g, c.b], v * 3)
      wob.set([s.wob.x, s.wob.y, s.wob.z], v * 3)
      t[v] = i / Math.max(1, n - 1)
      seed[v] = s.seed
      v++
    }
    for (let i = 0; i < n - 1; i++) {
      put(i)
      put(i + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aWob', new THREE.BufferAttribute(wob, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(t, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: { uReveal: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: alpha } },
  })
  material.userData.alpha = alpha
  geo.setAttribute('aFill', new THREE.BufferAttribute(new Float32Array(segs * 2), 1))
  const lines = new THREE.LineSegments(geo, material)
  lines.frustumCulled = false
  parent.add(lines)

  // Velos: triángulos entre hilos vecinos de la misma cinta, con el mismo material (misma
  // ondulación, trazado y pulso); aFill = 1 los hace tenues.
  const fp: number[] = []
  const fc: number[] = []
  const fw: number[] = []
  const ft: number[] = []
  const fs: number[] = []
  const vert = (st: Strand, i: number) => {
    const p = st.points[i]!
    const c = st.colors[Math.min(i, st.colors.length - 1)]!
    fp.push(p.x, p.y, p.z)
    fc.push(c.r, c.g, c.b)
    fw.push(st.wob.x, st.wob.y, st.wob.z)
    ft.push(i / Math.max(1, st.points.length - 1))
    fs.push(st.seed)
  }
  for (let j = 0; j < strands.length - 1; j++) {
    const a = strands[j]!
    const b = strands[j + 1]!
    if (a.sheet === undefined || a.sheet !== b.sheet || a.points.length !== b.points.length) continue
    for (let i = 0; i < a.points.length - 1; i++) {
      vert(a, i), vert(b, i), vert(a, i + 1)
      vert(a, i + 1), vert(b, i), vert(b, i + 1)
    }
  }
  if (fp.length) {
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3))
    fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3))
    fg.setAttribute('aWob', new THREE.Float32BufferAttribute(fw, 3))
    fg.setAttribute('aT', new THREE.Float32BufferAttribute(ft, 1))
    fg.setAttribute('aSeed', new THREE.Float32BufferAttribute(fs, 1))
    fg.setAttribute('aFill', new THREE.Float32BufferAttribute(new Float32Array(ft.length).fill(1), 1))
    const veil = new THREE.Mesh(fg, material)
    veil.frustumCulled = false
    // Se libera con la geometría de las líneas.
    lines.add(veil)
    lines.userData.veil = fg
  }
  return { points: lines, material }
}

type Rand = () => number
const lerpColor = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t)

/**
 * Cinta de hilos a lo largo de una curva: los hilos se reparten en una elipse plana alrededor
 * de la curva que gira mientras sube (la cinta se retuerce como en la referencia).
 */
export function ribbon(curve: THREE.Curve<THREE.Vector3>, opts: { strands: number; samples: number; width: number; twist: number; from: string; to: string; wob: number; rand: Rand }): Strand[] {
  const { strands, samples, width, twist, from, to, wob, rand } = opts
  const frames = curve.computeFrenetFrames(samples, false)
  const out: Strand[] = []
  const phase0 = rand() * Math.PI * 2
  const sheet = nextSheet()
  for (let i = 0; i < strands; i++) {
    const u = strands > 1 ? i / (strands - 1) - 0.5 : 0
    const points: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    for (let k = 0; k <= samples; k++) {
      const t = k / samples
      const c = curve.getPointAt(t)
      const N = frames.normals[k]!
      const B = frames.binormals[k]!
      const a = phase0 + t * twist
      // Cinta: ancho `width` en la dirección que gira y un grosor de un 18 %.
      const w = width * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)))
      const across = u * w
      const thick = Math.sin(u * Math.PI * 2 + t * 3) * w * 0.09
      const off = N.clone().multiplyScalar(Math.cos(a) * across - Math.sin(a) * thick).add(B.clone().multiplyScalar(Math.sin(a) * across + Math.cos(a) * thick))
      points.push(c.add(off))
      colors.push(lerpColor(from, to, t))
    }
    const N0 = frames.normals[0]!
    out.push({ points, colors, wob: N0.clone().multiplyScalar(wob), seed: phase0 * 0.1 + rand() * 0.05, sheet })
  }
  return out
}

/**
 * Cabeza de girasol en líneas, en el plano XY con la cara hacia +Z y radio `R`, llevada por
 * `m` a su sitio. Pétalos (haces que se abren y se cierran), disco (doble espiral) y anillo.
 */
export function sunflowerHead(R: number, m: THREE.Matrix4, rand: Rand, petals = 22): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  // Pétalos: cada uno, 12 hilos entre dos bordes que se juntan en la base y en la punta.
  for (let k = 0; k < petals; k++) {
    const ring = k % 2 // dos coronas alternas, la de atrás algo más larga
    const a = (k / petals) * Math.PI * 2 + (rand() - 0.5) * 0.12
    const r0 = R * 0.3
    const r1 = R * (ring ? 0.92 : 1) * (0.9 + rand() * 0.15)
    const w = R * (0.13 + rand() * 0.03)
    const lines = 12
    const ca = Math.cos(a)
    // Cada pétalo es una cinta que se retuerce (entra y sale del plano) a lo largo.
    const twist = (rand() - 0.5) * 0.8 + (ring ? 1.3 : -1.3)
    const sa = Math.sin(a)
    const sheet = nextSheet()
    const petalSeed = rand()
    for (let j = 0; j < lines; j++) {
      const u = j / (lines - 1) - 0.5
      const points: THREE.Vector3[] = []
      const colors: THREE.Color[] = []
      for (let s = 0; s <= 14; s++) {
        const t = s / 14
        const r = r0 + (r1 - r0) * t
        const across = w * Math.sin(Math.PI * t) ** 0.7 * u * 2
        const phi = (t - 0.35) * twist
        const lat = across * Math.cos(phi)
        // Se curva hacia atrás en la punta; el giro de la cinta la saca del plano.
        const z = -R * 0.12 * t * t * (ring ? 1.3 : 1) + across * Math.sin(phi) * 0.8 - ring * R * 0.03
        points.push(tx(new THREE.Vector3(ca * r - sa * lat, sa * r + ca * lat, z)))
        colors.push(lerpColor('#ff9f1a', '#ffe36e', t * 0.85 + Math.abs(u) * 0.25))
      }
      out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.035), seed: petalSeed + j * 0.004, sheet })
    }
  }
  // Disco: dos familias de espirales (las semillas del girasol), de oscuro a cobre.
  const spirals = 26
  for (const dir of [1, -1]) {
    for (let k = 0; k < spirals; k++) {
      const a0 = (k / spirals) * Math.PI * 2
      const points: THREE.Vector3[] = []
      const colors: THREE.Color[] = []
      for (let s = 0; s <= 12; s++) {
        const t = s / 12
        const r = R * 0.3 * t
        const a = a0 + dir * t * 2.4
        points.push(tx(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, R * 0.06 * (1 - t * t))))
        colors.push(lerpColor('#2a1204', '#8a3e0c', t))
      }
      out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.01), seed: rand() })
    }
  }
  // Anillo cobrizo alrededor del disco.
  for (let j = 0; j < 3; j++) {
    const points: THREE.Vector3[] = []
    const rr = R * (0.29 + j * 0.015)
    for (let s = 0; s <= 48; s++) {
      const a = (s / 48) * Math.PI * 2
      points.push(tx(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.02)))
    }
    out.push({ points, colors: [new THREE.Color('#c0600f')], wob: zAxis.clone().multiplyScalar(R * 0.01), seed: rand() })
  }
  return out
}

/** Hoja en líneas: un haz verde que sale de `at` hacia `dir`, con la punta arqueada. */
export function leaf(at: THREE.Vector3, dir: THREE.Vector3, length: number, rand: Rand): Strand[] {
  const out: Strand[] = []
  const d = dir.clone().normalize()
  const side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0))
  if (side.lengthSq() < 1e-4) side.set(1, 0, 0)
  side.normalize()
  const up = new THREE.Vector3().crossVectors(side, d).normalize()
  const lines = 9
  const sheet = nextSheet()
  const leafSeed = rand()
  for (let j = 0; j < lines; j++) {
    const u = j / (lines - 1) - 0.5
    const points: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    for (let s = 0; s <= 14; s++) {
      const t = s / 14
      const w = length * 0.28 * Math.sin(Math.PI * t) ** 0.8 * u * 2
      const droop = -length * 0.25 * t * t
      points.push(at.clone().add(d.clone().multiplyScalar(length * t)).add(side.clone().multiplyScalar(w)).add(up.clone().multiplyScalar(droop)))
      colors.push(lerpColor('#2f7a3a', '#9ccf5a', t * 0.7 + Math.abs(u) * 0.3))
    }
    out.push({ points, colors, wob: up.clone().multiplyScalar(length * 0.05), seed: leafSeed + j * 0.004, sheet })
  }
  return out
}

/** Papel en líneas: dos familias de hélices sobre el cono que se cruzan (como un tejido). */
export function wrapCone(tip: THREE.Vector3, height: number, R: number, rand: Rand): Strand[] {
  const out: Strand[] = []
  const count = 34
  for (const dir of [1, -1]) {
    // Solo una familia lleva velo (si no, el papel se vería doble de opaco).
    const sheet = dir > 0 ? nextSheet() : undefined
    for (let k = 0; k < count; k++) {
      const a0 = (k / count) * Math.PI * 2
      const points: THREE.Vector3[] = []
      const colors: THREE.Color[] = []
      for (let s = 0; s <= 30; s++) {
        const v = s / 30
        const rad = 0.04 + R * (0.15 * v + 0.85 * v ** 0.92)
        const a = a0 + dir * v * 1.6
        points.push(new THREE.Vector3(Math.sin(a) * rad, v * height, Math.cos(a) * rad).add(tip))
        colors.push(lerpColor('#b88a5a', '#fff1d6', v))
      }
      out.push({ points, colors, wob: new THREE.Vector3(Math.sin(a0), 0, Math.cos(a0)).multiplyScalar(R * 0.03), seed: rand(), ...(sheet !== undefined ? { sheet } : {}) })
    }
  }
  return out
}
