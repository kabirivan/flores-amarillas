/**
 * Las líneas de tiempo de la apertura, en segundos, con t = 0 al tocar «Abrir».
 * Una sola fuente de verdad: la consumen los componentes, el canvas de partículas, el
 * hook de secuencia y los tests.
 *
 * Es la apertura por tiempo (~6,4 s), la que se usa sin WebGL2: los tallos crecen,
 * brotan capullos y las flores se abren una a una. La historia 3D tiene su propia
 * línea de tiempo, ligada al scroll (lib/three/timeline.ts).
 */

export type Ease = readonly [number, number, number, number]

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1],
  outQuint: [0.22, 1, 0.36, 1],
  backOut: [0.34, 1.56, 0.64, 1],
  inQuad: [0.55, 0.085, 0.68, 0.53],
} as const satisfies Record<string, Ease>

export const SPRING = {
  leaf: { type: 'spring', stiffness: 260, damping: 18 },
  bloom: { type: 'spring', stiffness: 180, damping: 14 },
  wrap: { type: 'spring', stiffness: 200, damping: 22 },
  shake: { type: 'spring', stiffness: 520, damping: 9 },
} as const

export type Step = { start: number; dur: number }
export type Choreography = 'garden'

/** Común a las dos coreografías. */
export const ENVELOPE: Step = { start: 0, dur: 0.45 }

/** Pasos exclusivos de la coreografía de jardín. */
export const GARDEN = {
  seed: { start: 0.3, dur: 0.3 },
  stems: { start: 0.5, dur: 1.6 },
  leaves: { start: 1.1, dur: 1.3 },
  wrap: { start: 3.9, dur: 0.9 },
  ribbon: { start: 4.6, dur: 0.7 },
} as const satisfies Record<string, Step>

export type Timeline = {
  choreography: Choreography
  envelope: Step
  /** Ventana de floración de las cabezas. */
  flowers: Step
  /** Duración de la floración de una flor (antes de ajustar por especie). */
  bloomDur: number
  /** Cuánto del gesto de floración se ve: 1 = desde cerrada, 0.35 = un último gesto. */
  bloomAmount: number
  /** Cuándo empieza a verse el ramo vectorial (0 = desde el principio). */
  reveal: number
  text: Step
  pollen: Step
  /** Aparición del certificado: lo último, cierra la secuencia. */
  certificate: number
  total: number
}

const finish = (tl: Omit<Timeline, 'total'>): Timeline => ({ ...tl, total: tl.certificate + 0.6 })

export const TIMELINES: Record<Choreography, Timeline> = {
  garden: finish({
    choreography: 'garden',
    envelope: ENVELOPE,
    flowers: { start: 1.8, dur: 2.4 },
    bloomDur: 0.95,
    bloomAmount: 1,
    reveal: 0,
    text: { start: 5.0, dur: 0.9 },
    pollen: { start: 5.3, dur: 1.1 },
    certificate: 5.8,
  }),
}

/** A cuántas unidades por encima del atado flota el sobre en el jardín: de ahí cae la semilla. */
export const ENVELOPE_LIFT = 190

// ---------------------------------------------------------------------------
// Floración (las dos coreografías)
// ---------------------------------------------------------------------------

/**
 * Inicio y duración de la floración de la flor n.º `order`. El escalonado se comprime
 * para que la última termine dentro de la ventana, tenga el ramo 5 flores u 11.
 */
export function bloomTiming(
  order: number,
  count: number,
  speciesBloom: number,
  tl: Timeline,
): { delay: number; duration: number } {
  const { start, dur } = tl.flowers
  const duration = tl.bloomDur * speciesBloom
  const room = Math.max(0, dur - tl.bloomDur * 1.25)
  const stagger = count > 1 ? Math.min(0.18, room / (count - 1)) : 0
  return { delay: start + order * stagger, duration }
}

/** Instante en que la flor ha terminado de abrirse: a partir de ahí se mece con el viento. */
export function settleTime(order: number, count: number, speciesBloom: number, tl: Timeline): number {
  const bloom = bloomTiming(order, count, speciesBloom, tl)
  return bloom.delay + bloom.duration + 0.4
}

// ---------------------------------------------------------------------------
// Solo jardín
// ---------------------------------------------------------------------------

const STEM_STAGGER = 0.08

/** Ventana del tallo de la flor n.º `order` de `count`. */
export function stemTiming(order: number, count: number): { delay: number; duration: number } {
  const { start, dur } = GARDEN.stems
  const duration = Math.max(0.7, dur - (count - 1) * STEM_STAGGER)
  return { delay: start + order * STEM_STAGGER, duration }
}

/** La hoja se despliega cuando el tallo que crece llega hasta ella. */
export function leafDelay(order: number, count: number, t: number): number {
  const stem = stemTiming(order, count)
  return Math.max(GARDEN.leaves.start, stem.delay + stem.duration * t * 0.9)
}

/**
 * Capullo: aparece en la punta cuando el tallo está casi entero y revienta justo cuando
 * empieza la floración.
 */
export function budTiming(order: number, count: number, speciesBloom: number): { appear: number; burst: number } {
  const stem = stemTiming(order, count)
  const bloom = bloomTiming(order, count, speciesBloom, TIMELINES.garden)
  const appear = stem.delay + stem.duration * 0.62
  return { appear, burst: Math.max(appear + 0.3, bloom.delay) }
}
