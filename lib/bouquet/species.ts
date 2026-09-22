/**
 * Las cinco especies amarillas. Cada una tiene su propia silueta y su propia manera de
 * abrirse, pero todas comparten la misma gramática de dibujo (pétalos cúbicos sin
 * contorno, sombra interior, centro cálido) para que el ramo se lea como una familia.
 *
 * `buildHead` devuelve la disposición ya calculada. Tanto los componentes animados como
 * el renderizador estático recorren esa misma estructura.
 */

import type { PetalShape } from './geometry'
import type { Rng } from './prng'
import { toneAt, type FlowerTone } from './palette'

export const SPECIES_LIST = ['sunflower', 'daisy', 'tulip', 'freesia', 'mimosa'] as const
export type Species = (typeof SPECIES_LIST)[number]

export type SpeciesInfo = {
  /** Nombre en singular, para el aria-label y el certificado. */
  one: string
  /** Nombre en plural. */
  many: string
  /** Peso relativo al repartir las flores del ramo. */
  weight: number
  /** Escala de la cabeza, [min, max]. */
  scale: [number, number]
  /** Largo del tallo en unidades del lienzo, [min, max]. */
  stem: [number, number]
  /** Posición preferida en la rampa amarilla, [min, max]. */
  tone: [number, number]
  /** Cuántas hojas cuelgan del tallo, [min, max]. */
  leaves: [number, number]
  /** Duración relativa de su floración (1 = la ventana completa de la especie media). */
  bloom: number
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  sunflower: {
    one: 'girasol',
    many: 'girasoles',
    weight: 1.0,
    scale: [1.0, 1.22],
    stem: [200, 275],
    tone: [3, 5],
    leaves: [1, 2],
    bloom: 1.15,
  },
  daisy: {
    one: 'margarita',
    many: 'margaritas',
    weight: 1.25,
    scale: [0.78, 1.0],
    stem: [225, 310],
    tone: [1, 3],
    leaves: [1, 2],
    bloom: 0.9,
  },
  tulip: {
    one: 'tulipán',
    many: 'tulipanes',
    weight: 0.9,
    scale: [0.9, 1.12],
    stem: [240, 320],
    tone: [2, 4],
    leaves: [1, 2],
    bloom: 1.0,
  },
  freesia: {
    one: 'fresia',
    many: 'fresias',
    weight: 0.85,
    scale: [0.85, 1.05],
    stem: [215, 290],
    tone: [2, 4],
    leaves: [0, 1],
    bloom: 1.25,
  },
  mimosa: {
    one: 'rama de mimosa',
    many: 'ramas de mimosa',
    weight: 0.95,
    scale: [0.85, 1.1],
    stem: [230, 300],
    tone: [2, 4],
    leaves: [1, 2],
    bloom: 1.1,
  },
}

// ---------------------------------------------------------------------------
// Disposición de la cabeza
// ---------------------------------------------------------------------------

export type Petal = {
  /** Grados desde arriba, en sentido horario. */
  angle: number
  /** Desplazamiento radial de la base del pétalo respecto al centro. */
  radius: number
  shape: PetalShape
  /** Orden de apertura dentro de la flor, 0–1. */
  t: number
  /** Ligera variación de tono, −1 a 1. */
  shift: number
}

export type CoreDot = { x: number; y: number; r: number }

export type Floret = {
  x: number
  y: number
  r: number
  /** Orden de apertura dentro de la flor, 0–1. */
  t: number
  shift: number
}

export type HeadLayout =
  /** Girasol y margarita: coronas de pétalos alrededor de un centro. */
  | {
      kind: 'rosette'
      radius: number
      petals: Petal[]
      core: { radius: number; dots: CoreDot[] }
    }
  /** Tulipán: copa cerrada de pétalos que se separan. */
  | {
      kind: 'cup'
      radius: number
      back: Petal[]
      front: Petal[]
    }
  /** Fresia: campanas a lo largo de una espiga curvada. */
  | {
      kind: 'spike'
      radius: number
      bells: { x: number; y: number; angle: number; scale: number; t: number; shift: number }[]
      spine: string
    }
  /** Mimosa: pompones esponjosos en racimo. */
  | {
      kind: 'pompons'
      radius: number
      florets: Floret[]
      twigs: string[]
    }

const r2 = (v: number): number => Math.round(v * 100) / 100

export function buildHead(species: Species, rng: Rng): HeadLayout {
  switch (species) {
    case 'sunflower':
      return buildSunflower(rng)
    case 'daisy':
      return buildDaisy(rng)
    case 'tulip':
      return buildTulip(rng)
    case 'freesia':
      return buildFreesia(rng)
    case 'mimosa':
      return buildMimosa(rng)
  }
}

function buildSunflower(rng: Rng): HeadLayout {
  const outer = rng.int(13, 17)
  const inner = Math.max(9, outer - 4)
  const coreR = rng.range(17, 21)
  const petals: Petal[] = []

  // Corona exterior: pétalos largos y lanceolados.
  for (let i = 0; i < outer; i++) {
    const base = (360 / outer) * i
    petals.push({
      angle: r2(base + rng.gauss(0, 3.5)),
      radius: r2(coreR * 0.72),
      shape: {
        length: r2(rng.gauss(40, 2.6)),
        width: r2(rng.gauss(9.2, 0.7)),
        waist: 0.45,
        base: 0.34,
        tip: 0.22,
        notch: 0,
        bend: r2(rng.gauss(0, 0.2)),
      },
      t: r2(0.25 + (i / outer) * 0.55),
      shift: r2(rng.range(-0.6, 0.6)),
    })
  }

  // Corona interior, más corta y girada para rellenar los huecos.
  const offset = 360 / outer / 2
  for (let i = 0; i < inner; i++) {
    const base = (360 / inner) * i + offset
    petals.push({
      angle: r2(base + rng.gauss(0, 4)),
      radius: r2(coreR * 0.5),
      shape: {
        length: r2(rng.gauss(27, 2)),
        width: r2(rng.gauss(7.4, 0.6)),
        waist: 0.48,
        base: 0.4,
        tip: 0.3,
        notch: 0,
        bend: r2(rng.gauss(0, 0.2)),
      },
      t: r2(rng.range(0, 0.3)),
      shift: r2(rng.range(-0.4, 1.2)),
    })
  }

  return {
    kind: 'rosette',
    radius: r2(coreR + 40),
    petals,
    core: { radius: r2(coreR), dots: seedDots(rng, coreR, 46) },
  }
}

function buildDaisy(rng: Rng): HeadLayout {
  const count = rng.int(11, 15)
  const coreR = rng.range(8.5, 11)
  const petals: Petal[] = []

  for (let i = 0; i < count; i++) {
    const base = (360 / count) * i
    petals.push({
      angle: r2(base + rng.gauss(0, 4.5)),
      radius: r2(coreR * 0.62),
      shape: {
        length: r2(rng.gauss(30, 2.4)),
        width: r2(rng.gauss(6.4, 0.6)),
        waist: 0.62,
        base: 0.3,
        tip: 0.85,
        notch: rng.chance(0.65) ? r2(rng.range(0.25, 0.55)) : 0,
        bend: r2(rng.gauss(0, 0.2)),
      },
      t: r2((i / count) * 0.8 + rng.range(0, 0.2)),
      shift: r2(rng.range(-0.8, 0.5)),
    })
  }

  return {
    kind: 'rosette',
    radius: r2(coreR + 30),
    petals,
    core: { radius: r2(coreR), dots: seedDots(rng, coreR, 14) },
  }
}

function buildTulip(rng: Rng): HeadLayout {
  const shape = (length: number, width: number, tip: number): PetalShape => ({
    length: r2(length),
    width: r2(width),
    waist: 0.55,
    base: 0.22,
    tip,
    notch: 0,
    bend: r2(rng.gauss(0, 0.12)),
  })

  // Tres pétalos detrás, abiertos hacia fuera.
  const back: Petal[] = [-34, 0, 34].map((angle, i) => ({
    angle: r2(angle + rng.gauss(0, 2.5)),
    radius: 2,
    shape: shape(rng.gauss(46, 2), rng.gauss(15.5, 0.8), 0.62),
    t: r2(0.1 + i * 0.08),
    shift: r2(rng.range(0.2, 1)),
  }))

  // Tres delante, más cerrados: son los que se separan al abrirse.
  const front: Petal[] = [-17, 17].map((angle, i) => ({
    angle: r2(angle + rng.gauss(0, 2)),
    radius: 0,
    shape: shape(rng.gauss(41, 1.8), rng.gauss(13.5, 0.7), 0.7),
    t: r2(0.45 + i * 0.12),
    shift: r2(rng.range(-0.9, -0.2)),
  }))
  front.push({
    angle: r2(rng.gauss(0, 1.5)),
    radius: 0,
    shape: shape(rng.gauss(43, 1.8), rng.gauss(12, 0.6), 0.75),
    t: 0.72,
    shift: r2(rng.range(-1, -0.4)),
  })

  return { kind: 'cup', radius: r2(rng.gauss(30, 1.5)), back, front }
}

function buildFreesia(rng: Rng): HeadLayout {
  const count = rng.int(4, 6)
  const bells: Extract<HeadLayout, { kind: 'spike' }>['bells'] = []
  // La espiga se curva hacia un lado; las campanas van de la base a la punta.
  const dir = rng.chance(0.5) ? 1 : -1
  const span = rng.range(72, 96)

  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    const x = dir * (t * span * 0.62 + Math.sin(t * Math.PI) * 9)
    const y = -t * span
    pts.push({ x: r2(x), y: r2(y) })
    bells.push({
      x: r2(x),
      y: r2(y),
      angle: r2(dir * (18 + t * 34) + rng.gauss(0, 5)),
      scale: r2(1.06 - t * 0.3 + rng.range(-0.05, 0.05)),
      t: r2(1 - t * 0.85),
      shift: r2(rng.range(-1, 0.6)),
    })
  }

  const first = pts[0] ?? { x: 0, y: 0 }
  const last = pts[pts.length - 1] ?? first
  const spine =
    `M0,10Q${r2(first.x + dir * 6)},${r2(-span * 0.35)} ` +
    `${r2(last.x - dir * 4)},${r2(last.y + 6)}`

  return { kind: 'spike', radius: r2(span * 0.55), bells, spine }
}

function buildMimosa(rng: Rng): HeadLayout {
  const florets: Floret[] = []
  const twigs: string[] = []
  const branches = rng.int(3, 4)
  const spread = rng.range(30, 40)

  for (let b = 0; b < branches; b++) {
    const t = branches === 1 ? 0.5 : b / (branches - 1)
    const angle = (-52 + t * 104 + rng.gauss(0, 7)) * (Math.PI / 180)
    const len = rng.range(30, 46)
    const tipX = r2(Math.sin(angle) * len)
    const tipY = r2(-Math.cos(angle) * len - 6)
    twigs.push(`M0,6Q${r2(tipX * 0.35)},${r2(tipY * 0.55)} ${tipX},${tipY}`)

    const perBranch = rng.int(4, 6)
    for (let i = 0; i < perBranch; i++) {
      const u = (i + 1) / perBranch
      florets.push({
        x: r2(tipX * u + rng.gauss(0, 4.5)),
        y: r2(tipY * u + rng.gauss(0, 4.5) - u * 4),
        r: r2(rng.gauss(7.4, 1.1)),
        t: r2(Math.min(1, u * 0.7 + t * 0.3 + rng.range(-0.08, 0.08))),
        shift: r2(rng.range(-1, 1)),
      })
    }
  }

  // Un par de pompones sueltos rellenan el racimo.
  for (let i = 0; i < 3; i++) {
    florets.push({
      x: r2(rng.gauss(0, spread * 0.45)),
      y: r2(-rng.range(6, 26)),
      r: r2(rng.gauss(6.6, 0.9)),
      t: r2(rng.range(0.1, 0.5)),
      shift: r2(rng.range(-1, 1)),
    })
  }

  return { kind: 'pompons', radius: r2(spread + 14), florets, twigs }
}

/** Puntos del centro sembrados en espiral de Fermat: así se ven los capítulos reales. */
function seedDots(rng: Rng, radius: number, count: number): CoreDot[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const jitter = rng.range(0, Math.PI * 2)
  const dots: CoreDot[] = []
  for (let i = 0; i < count; i++) {
    const r = radius * 0.82 * Math.sqrt((i + 0.5) / count)
    const a = i * golden + jitter
    dots.push({
      x: r2(Math.cos(a) * r),
      y: r2(Math.sin(a) * r),
      r: r2(radius * 0.075 + (1 - r / radius) * radius * 0.03),
    })
  }
  return dots
}

/** Tono de la flor a partir de la especie y una desviación individual. */
export function toneFor(species: Species, rng: Rng): FlowerTone {
  const [lo, hi] = SPECIES[species].tone
  return toneAt(rng.range(lo, hi + 0.99))
}
