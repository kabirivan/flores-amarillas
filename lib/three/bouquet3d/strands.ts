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
  float wave = sin(aT * 5.0 - uTime * 1.1 + aSeed * 6.2832);
  vec3 p = position + aWob * wave;
  // Trazado: cada hilo se dibuja desde su origen; los hilos arrancan escalonados.
  float grow = smoothstep(0.0, 0.06, uReveal * 1.3 - aT - aSeed * 0.3);
  // Pulso de luz que recorre el hilo.
  // Suave: un pulso fuerte y rápido, desfasado entre hilos vecinos, se ve como parpadeo.
  float pulse = 0.85 + 0.15 * sin(aT * 4.0 - uTime * 1.2 + aSeed * 3.0);
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
  // «!(vA > …)» también descarta NaN: con bloom, un solo NaN se emborrona en un bloque negro.
  if (!(vA > 0.002)) discard;
  vec3 c = clamp(vColor, 0.0, 4.0);
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
      const o = v * 3
      pos[o] = p.x
      pos[o + 1] = p.y
      pos[o + 2] = p.z
      col[o] = c.r
      col[o + 1] = c.g
      col[o + 2] = c.b
      wob[o] = s.wob.x
      wob[o + 1] = s.wob.y
      wob[o + 2] = s.wob.z
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
  // Primero se cuentan los vértices (arrays tipados de una vez: empujar a listas de JS
  // cientos de miles de valores era lo más lento de toda la escena).
  let tris = 0
  for (let j = 0; j < strands.length - 1; j++) {
    const a = strands[j]!
    const b = strands[j + 1]!
    if (a.sheet !== undefined && a.sheet === b.sheet && a.points.length === b.points.length) tris += (a.points.length - 1) * 2
  }
  if (tris > 0) {
    const nv = tris * 3
    const fp = new Float32Array(nv * 3)
    const fc = new Float32Array(nv * 3)
    const fw = new Float32Array(nv * 3)
    const ft = new Float32Array(nv)
    const fs = new Float32Array(nv)
    let w = 0
    const vert = (st: Strand, i: number) => {
      const p = st.points[i]!
      const c = st.colors[Math.min(i, st.colors.length - 1)]!
      const o = w * 3
      fp[o] = p.x
      fp[o + 1] = p.y
      fp[o + 2] = p.z
      fc[o] = c.r
      fc[o + 1] = c.g
      fc[o + 2] = c.b
      fw[o] = st.wob.x
      fw[o + 1] = st.wob.y
      fw[o + 2] = st.wob.z
      ft[w] = i / Math.max(1, st.points.length - 1)
      fs[w] = st.seed
      w++
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
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3))
    fg.setAttribute('color', new THREE.BufferAttribute(fc, 3))
    fg.setAttribute('aWob', new THREE.BufferAttribute(fw, 3))
    fg.setAttribute('aT', new THREE.BufferAttribute(ft, 1))
    fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1))
    fg.setAttribute('aFill', new THREE.BufferAttribute(new Float32Array(nv).fill(1), 1))
    const veil = new THREE.Mesh(fg, material)
    veil.frustumCulled = false
    // Se libera con la geometría de las líneas.
    lines.add(veil)
    lines.userData.veil = fg
  }
  return { points: lines, material }
}

type Rand = () => number
/** Colores ya interpretados: convertir el hexadecimal en cada punto de cada hilo era lo más lento. */
const parsed = new Map<string, THREE.Color>()
const hex = (h: string) => {
  let c = parsed.get(h)
  if (!c) parsed.set(h, (c = new THREE.Color(h)))
  return c
}
const lerpColor = (a: string, b: string, t: number) => hex(a).clone().lerp(hex(b), t)

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
/** Estilo de una cabeza radial (girasol, margarita, gerbera). */
export type HeadStyle = {
  /** Radio del disco, en fracción de R (los pétalos nacen en su borde). */
  disc: number
  /** Ancho de cada pétalo, en fracción de R. */
  width: number
  petalFrom: string
  petalTo: string
  discFrom: string
  discTo: string
  ring: string
}

export const SUNFLOWER: HeadStyle = { disc: 0.3, width: 0.13, petalFrom: '#ff9f1a', petalTo: '#ffe36e', discFrom: '#2a1204', discTo: '#8a3e0c', ring: '#c0600f' }
/** Margarita amarilla: muchos pétalos finos y claros, botón dorado. */
export const DAISY: HeadStyle = { disc: 0.2, width: 0.06, petalFrom: '#ffe36e', petalTo: '#fff6c2', discFrom: '#ff8a00', discTo: '#ffc12e', ring: '#ffb627' }
/** Gerbera: corona densa amarillo intenso, centro oscuro con anillo cobrizo. */
export const GERBERA: HeadStyle = { disc: 0.24, width: 0.085, petalFrom: '#ffb000', petalTo: '#ffe066', discFrom: '#3a1a06', discTo: '#a8561a', ring: '#e07a10' }

export function sunflowerHead(R: number, m: THREE.Matrix4, rand: Rand, petals = 22, perPetal = 12, spirals = 26, style: HeadStyle = SUNFLOWER): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  // Pétalos: cada uno, 12 hilos entre dos bordes que se juntan en la base y en la punta.
  for (let k = 0; k < petals; k++) {
    const ring = k % 2 // dos coronas alternas, la de atrás algo más larga
    const a = (k / petals) * Math.PI * 2 + (rand() - 0.5) * 0.12
    const r0 = R * style.disc
    const r1 = R * (ring ? 0.92 : 1) * (0.9 + rand() * 0.15)
    const w = R * (style.width + rand() * 0.03)
    const lines = perPetal
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
        colors.push(lerpColor(style.petalFrom, style.petalTo, t * 0.85 + Math.abs(u) * 0.25))
      }
      out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.018), seed: petalSeed + j * 0.004, sheet })
    }
  }
  // Disco: dos familias de espirales (las semillas del girasol), de oscuro a cobre.
  for (const dir of [1, -1]) {
    for (let k = 0; k < spirals; k++) {
      const a0 = (k / spirals) * Math.PI * 2
      const points: THREE.Vector3[] = []
      const colors: THREE.Color[] = []
      for (let s = 0; s <= 12; s++) {
        const t = s / 12
        const r = R * style.disc * t
        const a = a0 + dir * t * 2.4
        points.push(tx(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, R * 0.06 * (1 - t * t))))
        colors.push(lerpColor(style.discFrom, style.discTo, t))
      }
      out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.01), seed: rand() })
    }
  }
  // Anillo cobrizo alrededor del disco.
  for (let j = 0; j < 3; j++) {
    const points: THREE.Vector3[] = []
    const rr = R * (style.disc - 0.01 + j * 0.015)
    for (let s = 0; s <= 48; s++) {
      const a = (s / 48) * Math.PI * 2
      points.push(tx(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.02)))
    }
    out.push({ points, colors: [hex(style.ring)], wob: zAxis.clone().multiplyScalar(R * 0.01), seed: rand() })
  }
  return out
}

/**
 * Rosa: capas de pétalos en espiral, cada pétalo un arco de hilos que sube y se abre en el
 * borde; las capas de dentro, más altas y cerradas. La cara mira hacia +Z.
 */
export function roseHead(R: number, m: THREE.Matrix4, rand: Rand): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  const layers = 5
  let a0 = rand() * Math.PI * 2
  for (let L = 0; L < layers; L++) {
    const n = 2 + L
    const rL = R * (0.14 + L * 0.19)
    const zL = R * (0.42 - L * 0.1)
    const hp = R * (0.26 + L * 0.02)
    const span = ((Math.PI * 2) / n) * 1.35
    for (let p = 0; p < n; p++) {
      const a = a0 + (p / n) * Math.PI * 2
      const sheet = nextSheet()
      const seed = rand()
      for (let k = 0; k < 6; k++) {
        const v = k / 5
        const points: THREE.Vector3[] = []
        const colors: THREE.Color[] = []
        for (let s = 0; s <= 16; s++) {
          const t = s / 16
          const th = a + t * span
          const bulge = Math.sin(Math.PI * t) ** 0.6
          const r = rL * (0.85 + 0.15 * bulge) + v * v * R * 0.1 * bulge
          const z = zL + v * hp * bulge - (1 - bulge) * hp * 0.2
          points.push(tx(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, z)))
          colors.push(lerpColor(L < 2 ? '#e89a00' : '#ffc21a', '#fff1a0', v * 0.8 + L * 0.04))
        }
        out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.012), seed: seed + k * 0.004, sheet })
      }
    }
    a0 += 0.9
  }
  return out
}

/** Tulipán: copa de seis pétalos (tres fuera, tres dentro) que suben y se cierran arriba. */
export function tulipHead(R: number, m: THREE.Matrix4, rand: Rand): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  const H = R * 1.5
  const a0 = rand() * Math.PI
  for (let p = 0; p < 6; p++) {
    const inner = p % 2 === 1
    const a = a0 + (p / 6) * Math.PI * 2
    const half = inner ? 0.42 : 0.5
    const sheet = nextSheet()
    const seed = rand()
    for (let k = 0; k < 8; k++) {
      const u = k / 7 - 0.5
      const points: THREE.Vector3[] = []
      const colors: THREE.Color[] = []
      for (let s = 0; s <= 16; s++) {
        const t = s / 16
        const r = R * (0.12 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 0.9)) ** 0.8) * (inner ? 0.9 : 1)
        const th = a + u * 2 * half * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.5
        points.push(tx(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, t * H * (inner ? 0.95 : 1))))
        colors.push(lerpColor('#e0a000', '#fff07a', t * 0.9 + Math.abs(u) * 0.2))
      }
      out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.015), seed: seed + k * 0.004, sheet })
    }
  }
  return out
}

/** Mimosa: una ramita con borlas; cada borla, tres aros cruzados (se lee como una bolita). */
export function mimosaHead(R: number, m: THREE.Matrix4, rand: Rand): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  const base = new THREE.Vector3(0, 0, -R * 0.3)
  const balls = 16 + Math.floor(rand() * 6)
  for (let b = 0; b < balls; b++) {
    const a = rand() * Math.PI * 2
    const d = R * Math.sqrt(rand()) * 0.9
    const c = new THREE.Vector3(Math.cos(a) * d, Math.sin(a) * d, R * 0.5 * rand())
    const br = R * (0.08 + rand() * 0.05)
    // Ramita hasta la borla.
    out.push({ points: [tx(base.clone()), tx(base.clone().lerp(c, 0.6).add(new THREE.Vector3(0, 0, R * 0.08))), tx(c.clone())], colors: [hex('#5fae5a')], wob: zAxis.clone().multiplyScalar(R * 0.02), seed: rand() })
    const seed = rand()
    for (let ring = 0; ring < 3; ring++) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ring * 1.05 + a, ring * 0.7, 0))
      const points: THREE.Vector3[] = []
      for (let s = 0; s <= 14; s++) {
        const th = (s / 14) * Math.PI * 2
        points.push(tx(new THREE.Vector3(Math.cos(th) * br, Math.sin(th) * br, 0).applyQuaternion(q).add(c)))
      }
      out.push({ points, colors: [hex(ring === 1 ? '#ffe34d' : '#ffd000')], wob: zAxis.clone().multiplyScalar(R * 0.015), seed: seed + ring * 0.01 })
    }
  }
  return out
}

/** Fresia: una espiga que se arquea con trompetitas que se abren de la base a la punta. */
export function freesiaHead(R: number, m: THREE.Matrix4, rand: Rand): Strand[] {
  const out: Strand[] = []
  const tx = (p: THREE.Vector3) => p.applyMatrix4(m)
  const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(m)
  const side = rand() < 0.5 ? -1 : 1
  const at = (t: number) => new THREE.Vector3(side * t * R * 1.3, Math.sin(t * 1.3) * R * 0.7, t * R * 0.25)
  const spine: THREE.Vector3[] = []
  for (let s = 0; s <= 16; s++) spine.push(tx(at(s / 16)))
  out.push({ points: spine, colors: [hex('#6fc05a')], wob: zAxis.clone().multiplyScalar(R * 0.03), seed: rand() })
  const bells = 7
  for (let b = 0; b < bells; b++) {
    const t = 0.12 + (b / (bells - 1)) * 0.88
    const c = at(t)
    const open = 1 - t * 0.75 // las de la base, abiertas; las de la punta, capullos
    const br = R * 0.26 * (0.45 + open * 0.55)
    const sheetSeed = rand()
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2 + rand() * 0.2
      const sheet = nextSheet()
      for (let k = 0; k < 3; k++) {
        const u = k / 2 - 0.5
        const points: THREE.Vector3[] = []
        const colors: THREE.Color[] = []
        for (let s = 0; s <= 8; s++) {
          const q = s / 8
          const r = br * q * (0.4 + 0.6 * open)
          const th = a + u * 0.5 * Math.sin(Math.PI * q)
          points.push(tx(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, R * 0.1 * q * (1 - open * 0.6)).add(c)))
          colors.push(lerpColor('#ff9f1a', '#fff3a0', q))
        }
        out.push({ points, colors, wob: zAxis.clone().multiplyScalar(R * 0.015), seed: sheetSeed + k * 0.004, sheet })
      }
    }
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
