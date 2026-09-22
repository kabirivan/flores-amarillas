/**
 * El jardín de luz: una nube de N puntos por capítulo. Todas las formas comparten el
 * mismo reparto de partículas (césped, cada flor, protagonista, ambiente), así que al
 * cambiar de capítulo cada partícula se transforma en su sitio: los capullos se abren en
 * pétalos, el césped se ilumina al amanecer, la lluvia se vuelve motas de sol.
 *
 * Puras y deterministas por semilla (sin Three.js), para poder testearlas.
 * Cada forma son dos Float32Array de N×4:
 * - `pos`: x, y, z y el tipo de movimiento que aplica el shader (MOTION).
 * - `col`: r, g, b (0–1) y el tamaño relativo del punto.
 */

import { createRng, type Rng } from '@/lib/bouquet/prng'
import { GROUND, type GardenFlower, type GardenLayout } from '../garden/layout'

export { GROUND }

export const MOTION = {
  still: 0,
  /** Cae y reaparece arriba (lluvia). */
  rain: 1,
  /** Sube despacio con vaivén (motas de sol, luciérnagas). */
  rise: 2,
  /** Órbita alrededor del eje vertical que pasa por la semilla. */
  orbit: 4,
} as const

export type Shape = { pos: Float32Array; col: Float32Array }
type RGB = readonly [number, number, number]

/** Estados del jardín, uno por capítulo. */
export const STATES = ['night', 'seed', 'sprout', 'rain', 'dawn', 'bloom', 'gather'] as const
export type GardenState = (typeof STATES)[number]

/** Reparto de partículas: el mismo para todas las formas. */
export type Blocks = {
  grass: [number, number]
  flowers: { start: number; count: number }[]
  hero: [number, number]
  ambient: [number, number]
}

export function blocksFor(n: number, layout: GardenLayout): Blocks {
  const grass = Math.round(n * 0.22)
  const flowerTotal = Math.round(n * 0.52)
  const hero = Math.round(n * 0.08)
  const weights = layout.flowers.map((f) => (f.yellow ? 2.4 : 1))
  const sum = weights.reduce((a, b) => a + b, 0)
  const flowers: { start: number; count: number }[] = []
  let at = grass
  layout.flowers.forEach((_, i) => {
    const count = i === layout.flowers.length - 1 ? grass + flowerTotal - at : Math.floor((flowerTotal * (weights[i] ?? 1)) / sum)
    flowers.push({ start: at, count })
    at += count
  })
  return { grass: [0, grass], flowers, hero: [at, at + hero], ambient: [at + hero, n] }
}

/** Para cada partícula, el índice de la flor del ramo a la que pertenece (o −1). */
export function bouquetMembership(n: number, layout: GardenLayout): Float32Array {
  const out = new Float32Array(n).fill(-1)
  const blocks = blocksFor(n, layout)
  layout.flowers.forEach((f, i) => {
    if (f.bouquet < 0) return
    const b = blocks.flowers[i]!
    out.fill(f.bouquet, b.start, b.start + b.count)
  })
  return out
}

// ---------------------------------------------------------------------------

type Writer = { put: (i: number, x: number, y: number, z: number, m: number, c: RGB, size: number, bright: number) => void; shape: Shape }

function writer(n: number): Writer {
  const pos = new Float32Array(n * 4)
  const col = new Float32Array(n * 4)
  return {
    put(i, x, y, z, m, c, size, bright) {
      const k = i * 4
      pos[k] = x
      pos[k + 1] = y
      pos[k + 2] = z
      pos[k + 3] = m
      col[k] = c[0] * bright
      col[k + 1] = c[1] * bright
      col[k + 2] = c[2] * bright
      col[k + 3] = size
    },
    shape: { pos, col },
  }
}

const GREEN: RGB = [0.35, 0.72, 0.45]
const GRASS: Record<GardenState, { c: RGB; b: number }> = {
  night: { c: [0.3, 0.55, 0.6], b: 0.28 },
  seed: { c: [0.3, 0.55, 0.6], b: 0.3 },
  sprout: { c: [0.3, 0.6, 0.55], b: 0.34 },
  rain: { c: [0.35, 0.55, 0.7], b: 0.34 },
  dawn: { c: [0.45, 0.75, 0.45], b: 0.42 },
  bloom: { c: [0.55, 0.78, 0.4], b: 0.45 },
  gather: { c: [0.55, 0.78, 0.4], b: 0.42 },
}

/** Césped: briznas cortas de 4 puntos, siempre en el mismo sitio. */
function grass(w: Writer, rng: Rng, [a, b]: [number, number], state: GardenState) {
  const { c, b: bright } = GRASS[state]
  for (let i = a; i < b; i += 4) {
    const x = rng.range(-13, 13)
    const z = rng.range(-17, 4)
    const h = rng.range(0.12, 0.42)
    const lean = rng.range(-0.08, 0.08)
    for (let k = 0; k < 4 && i + k < b; k++) {
      const t = k / 3
      w.put(i + k, x + lean * t, GROUND + h * t, z, MOTION.still, c, rng.range(0.5, 0.9), bright * (0.5 + t * 0.6))
    }
  }
}

/** Cabeza abierta: pétalos alrededor de un centro, mirando al frente y un poco arriba. */
function openHead(w: Writer, rng: Rng, from: number, to: number, cx: number, cy: number, cz: number, R: number, petals: number, c: RGB, bright: number, size: number, core: RGB) {
  const n = { x: 0, y: 0.5, z: 1 }
  const len = Math.hypot(n.x, n.y, n.z)
  n.x /= len
  n.y /= len
  n.z /= len
  // Base del plano de la cabeza.
  const u = { x: 1, y: 0, z: 0 }
  const v = { x: 0, y: n.z, z: -n.y }
  const coreR = R * 0.26
  for (let i = from; i < to; i++) {
    const isCore = rng.chance(0.22)
    let px: number
    let py: number
    let depth = 0
    let col = c
    let b = bright
    if (isCore) {
      const r = coreR * Math.sqrt(rng.next())
      const a = rng.next() * Math.PI * 2
      px = Math.cos(a) * r
      py = Math.sin(a) * r
      depth = coreR * 0.3 * (1 - (r / coreR) ** 2)
      col = core
      b = bright * 0.9
    } else {
      const j = rng.int(0, petals - 1)
      const a = (j / petals) * Math.PI * 2
      const r = coreR + (R - coreR) * Math.sqrt(rng.next())
      const along = (r - coreR) / (R - coreR)
      const half = R * 0.3 * Math.sin(Math.PI * Math.min(1, along * 0.95 + 0.05))
      // Más densos hacia el nervio central: el pétalo tiene forma, no es una mancha.
      const side = rng.range(-1, 1)
      const l = Math.sign(side) * Math.abs(side) ** 1.6 * half
      px = Math.cos(a) * r - Math.sin(a) * l
      py = Math.sin(a) * r + Math.cos(a) * l
      depth = R * 0.18 * along * along // copa suave
      b = bright * (0.75 + along * 0.4)
    }
    w.put(
      i,
      cx + u.x * px + v.x * py + n.x * depth,
      cy + u.y * px + v.y * py + n.y * depth,
      cz + u.z * px + v.z * py + n.z * depth,
      MOTION.still,
      col,
      size * rng.range(0.8, 1.2),
      b,
    )
  }
}

/** Capullo: un racimo apretado, verde que empieza a tomar su color. */
function bud(w: Writer, rng: Rng, from: number, to: number, cx: number, cy: number, cz: number, R: number, c: RGB, bright: number) {
  const tint: RGB = [c[0] * 0.55 + GREEN[0] * 0.45, c[1] * 0.55 + GREEN[1] * 0.45, c[2] * 0.55 + GREEN[2] * 0.45]
  for (let i = from; i < to; i++) {
    w.put(i, cx + rng.gauss(0, R * 0.16), cy + rng.gauss(0, R * 0.28) + R * 0.1, cz + rng.gauss(0, R * 0.16), MOTION.still, tint, rng.range(0.7, 1), bright)
  }
}

/** Tallo desde el suelo hasta la cabeza, algo inclinado. */
function stem(w: Writer, rng: Rng, from: number, to: number, x: number, z: number, h: number, lean: number, bright: number) {
  for (let i = from; i < to; i++) {
    const t = rng.next()
    w.put(i, x + lean * t * t + rng.gauss(0, 0.012), GROUND + h * t, z + rng.gauss(0, 0.012), MOTION.still, GREEN, rng.range(0.55, 0.85), bright)
  }
}

function flower(w: Writer, rng: Rng, f: GardenFlower, block: { start: number; count: number }, state: GardenState) {
  const open = f.yellow ? state === 'bloom' || state === 'gather' : state === 'dawn' || state === 'bloom' || state === 'gather'
  const night = state === 'night' || state === 'seed' || state === 'sprout' || state === 'rain'
  // Las amarillas son las que más brillan, sobre todo al florecer.
  const bright = (f.yellow ? (open ? 1.35 : 0.7) : open ? 0.62 : 0.35) * (night ? 0.8 : 1)
  const stemPts = Math.round(block.count * 0.14)
  const lean = f.tilt * 0.35
  const hx = f.x + lean
  const hy = GROUND + f.height
  stem(w, rng, block.start, block.start + stemPts, f.x, f.z, f.height, lean, bright * 0.45)
  const from = block.start + stemPts
  const to = block.start + block.count
  if (open) {
    const core: RGB = f.yellow ? [1, 0.55, 0.12] : [1, 0.85, 0.45]
    openHead(w, rng, from, to, hx, hy, f.z, f.radius, f.petals, f.color, bright, f.yellow ? 1 : 0.78, core)
  } else bud(w, rng, from, to, hx, hy, f.z, f.radius, f.color, bright)
}

/** La protagonista: la semilla que cae, brilla en la tierra, brota y florece. */
function hero(w: Writer, rng: Rng, [a, b]: [number, number], state: GardenState) {
  const n = b - a
  const glow = (count: number, from: number, cx: number, cy: number, cz: number, sigma: number, c: RGB, size: number) => {
    const bright = Math.min(1, 60 / Math.max(1, count)) * 4
    for (let i = from; i < from + count && i < b; i++) {
      w.put(i, cx + rng.gauss(0, sigma), cy + rng.gauss(0, sigma), cz + rng.gauss(0, sigma), MOTION.still, c, size * rng.range(0.7, 1.3), bright * rng.range(0.8, 1.2))
    }
  }
  const WARM: RGB = [1, 0.93, 0.7]
  const GOLD: RGB = [1, 0.8, 0.35]
  if (state === 'night') {
    glow(Math.round(n * 0.25), a, 0, GROUND + 3.2, 0, 0.07, WARM, 2)
    glow(n - Math.round(n * 0.25), a + Math.round(n * 0.25), 0, GROUND + 3.2, 0, 0.3, GOLD, 1)
    return
  }
  if (state === 'seed') {
    // Brilla bajo la tierra, con un anillo de luz en el suelo.
    glow(Math.round(n * 0.3), a, 0, GROUND + 0.08, 0, 0.07, WARM, 2)
    for (let i = a + Math.round(n * 0.3); i < b; i++) {
      const ang = rng.next() * Math.PI * 2
      const r = rng.range(0.25, 0.9)
      w.put(i, Math.cos(ang) * r, GROUND + 0.02, Math.sin(ang) * r, MOTION.orbit, GOLD, rng.range(0.6, 1.2), 0.35 * (1 - r / 1.1))
    }
    return
  }
  if (state === 'gather') {
    // Su flor ya es el ramo: la luz se posa como un halo tenue en el suelo, alrededor.
    for (let i = a; i < b; i++) {
      const ang = rng.next() * Math.PI * 2
      const r = rng.range(0.6, 1.8)
      w.put(i, Math.cos(ang) * r, GROUND + rng.range(0, 0.08), Math.sin(ang) * r, MOTION.orbit, GOLD, rng.range(0.5, 1), 0.22 * (1.9 - r))
    }
    return
  }
  // Brote y planta: tallo, hojas y, al final, la gran flor amarilla del frente.
  const top = state === 'sprout' ? 1.2 : state === 'rain' ? 1.7 : state === 'dawn' ? 2.3 : 2.6
  const bend = state === 'rain' ? 0.45 : 0
  const stemN = Math.round(n * 0.3)
  for (let i = a; i < a + stemN; i++) {
    const t = rng.next()
    w.put(i, 0.18 * Math.sin(t * Math.PI) + bend * t * t, GROUND + top * t, 0, MOTION.still, GREEN, rng.range(0.8, 1.2), 0.9)
  }
  const leaves = state === 'sprout' ? 2 : 4
  const leafN = Math.round(n * 0.3)
  for (let i = a + stemN; i < a + stemN + leafN; i++) {
    const k = rng.int(0, leaves - 1)
    const side = k % 2 === 0 ? 1 : -1
    const at = 0.25 + (k / leaves) * 0.5
    const L = (state === 'sprout' ? 0.5 : 0.8) * (1 - k * 0.12)
    const u = rng.next()
    const width = Math.sin(u * Math.PI) * L * 0.28
    w.put(
      i,
      side * u * L * 0.9 + bend * at * at,
      GROUND + top * at + u * L * 0.35 + rng.range(-1, 1) * width * 0.3,
      rng.range(-1, 1) * width,
      MOTION.still,
      [0.45, 0.82, 0.42],
      rng.range(0.8, 1.1),
      0.85,
    )
  }
  const headFrom = a + stemN + leafN
  const hx = bend
  const hy = GROUND + top
  if (state === 'bloom') {
    openHead(w, rng, headFrom, b, hx, hy, 0, 0.95, 18, [1, 0.84, 0.3], 1.6, 1.3, [0.95, 0.45, 0.1])
  } else if (state === 'dawn') {
    glow(b - headFrom, headFrom, hx, hy + 0.1, 0, 0.14, GOLD, 1.5)
  } else {
    bud(w, rng, headFrom, b, hx, hy, 0, 0.35, [1, 0.85, 0.4], 0.8)
  }
}

/** Ambiente: luciérnagas de noche, lluvia, motas de sol y polen dorado. */
function ambient(w: Writer, rng: Rng, [a, b]: [number, number], state: GardenState) {
  for (let i = a; i < b; i++) {
    const x = rng.range(-12, 12)
    const z = rng.range(-15, 4)
    if (state === 'rain') {
      w.put(i, rng.range(-12, 12), rng.range(-6, 8), rng.range(-12, 5), MOTION.rain, [0.62, 0.74, 0.95], rng.range(0.7, 1.2), rng.range(0.4, 0.8))
    } else if (state === 'night' || state === 'seed' || state === 'sprout') {
      // Luciérnagas: pocas y brillantes; el resto, polvo tenue a ras de césped.
      const fly = rng.chance(0.12)
      const y = GROUND + (fly ? rng.range(0.4, 2.8) : rng.range(0.05, 1.2))
      if (state === 'seed' && fly && rng.chance(0.18)) {
        // Unas pocas se acercan a la semilla y la rodean, a poca altura.
        const ang = rng.next() * Math.PI * 2
        const r = rng.range(0.35, 1.1)
        w.put(i, Math.cos(ang) * r, GROUND + rng.range(0.15, 0.8) * (1.2 - r * 0.5), Math.sin(ang) * r, MOTION.orbit, [0.9, 1, 0.55], 2, 1)
      } else {
        w.put(i, x, y, z, fly ? MOTION.rise : MOTION.still, fly ? [0.9, 1, 0.55] : [0.7, 0.8, 1], fly ? 2.2 : 0.6, fly ? 1 : 0.18)
      }
    } else {
      // De día: motas de sol y polen que suben.
      const warm: RGB = state === 'dawn' ? [1, 0.85, 0.6] : [1, 0.86, 0.45]
      w.put(i, x, GROUND + rng.range(0, 7), z, MOTION.rise, warm, rng.range(0.7, 1.8), rng.range(0.25, 0.7))
    }
  }
}

export function gardenShape(state: GardenState, n: number, layout: GardenLayout, seed: string): Shape {
  const rng = createRng(`jardin:${state}:${seed}`)
  const w = writer(n)
  const blocks = blocksFor(n, layout)
  grass(w, createRng(`cesped:${seed}`), blocks.grass, state) // mismo césped en todos los estados
  layout.flowers.forEach((f, i) => flower(w, createRng(`flor:${seed}:${i}`), f, blocks.flowers[i]!, state))
  hero(w, rng, blocks.hero, state)
  ambient(w, rng, blocks.ambient, state)
  return w.shape
}
