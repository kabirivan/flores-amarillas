/**
 * Línea de tiempo de la historia: convierte el progreso del scroll (0–1) en el estado de la
 * escena. Pura y testeable; el motor 3D solo la lee.
 *
 * Cada capítulo ocupa una altura de scroll (en pantallas). Al entrar en un capítulo, las
 * partículas pasan de la forma del anterior a la suya durante la primera parte del tramo, y
 * luego se quedan mientras se lee la frase.
 */

import { STATES, type GardenState } from './particles/shapes'

/** Estado del jardín de cada forma (índices de las texturas de partículas). */
export const SHAPES = STATES
export type ShapeName = GardenState

/** Capítulos del scroll. Contemplación y final no tienen frase: son el ramo. */
export const CHAPTERS = [
  { id: 'semilla', shape: 'night', sky: 0, height: 1.3, morph: 0.5, wind: 0.2 },
  { id: 'encuentro', shape: 'seed', sky: 0, height: 1.3, morph: 0.55, wind: 0.2 },
  { id: 'cuidar', shape: 'sprout', sky: 0.4, height: 1.3, morph: 0.55, wind: 0.3 },
  { id: 'lluvia', shape: 'rain', sky: 1, height: 1.3, morph: 0.5, wind: 1.4 },
  { id: 'sol', shape: 'dawn', sky: 2, height: 1.3, morph: 0.55, wind: 0.35 },
  { id: 'florecer', shape: 'bloom', sky: 3, height: 1.6, morph: 0.6, wind: 0.35 },
  { id: 'ramo', shape: 'gather', sky: 3, height: 2.4, morph: 0.2, wind: 0.3 },
  // Recorrido de cámara: acercarse a olerlo, verlo en 360° y alejarse al ramo entero.
  { id: 'contemplar', shape: 'gather', sky: 3, height: 3.4, morph: 0, wind: 0.25 },
  { id: 'final', shape: 'gather', sky: 3, height: 1.4, morph: 0, wind: 0.25 },
] as const satisfies readonly { id: string; shape: GardenState; sky: number; height: number; morph: number; wind: number }[]

export type CameraKey = { x: number; y: number; z: number; tx: number; ty: number; tz: number }

/**
 * Cámara de cada capítulo, a ras de jardín (suelo en y = −3,2; la semilla y el ramo en el
 * origen; el jardín se extiende hacia el fondo). Los objetivos van algo por debajo de lo que
 * se mira para que la escena quede arriba y las frases, abajo, no la tapen.
 */
export const CAMERAS: readonly CameraKey[] = [
  { x: 0, y: -1.2, z: 7.5, tx: 0, ty: -1.4, tz: -1 }, // semilla cayendo
  { x: 0.6, y: -2.1, z: 4.4, tx: 0, ty: -3.1, tz: 0 }, // brilla en la tierra
  { x: 1.3, y: -1.9, z: 5, tx: 0, ty: -2.8, tz: 0 }, // brota
  { x: -1.6, y: -1.3, z: 6.4, tx: 0, ty: -2.6, tz: -1 }, // lluvia
  { x: 0.8, y: -1.5, z: 6.8, tx: 0, ty: -2.4, tz: -2 }, // amanecer
  { x: 0, y: 2.6, z: 10.5, tx: 0, ty: -3, tz: -5 }, // el jardín florece, desde arriba
  { x: 0, y: -0.4, z: 8.6, tx: 0, ty: -2.1, tz: -1.5 }, // el ramo se forma
  { x: 0, y: -0.4, z: 8.6, tx: 0, ty: -2.1, tz: -1.5 }, // contemplar (el motor sigue el recorrido)
  { x: 0, y: -0.9, z: 7, tx: 0, ty: -2, tz: 0 }, // final
]

const TOTAL = CHAPTERS.reduce((s, c) => s + c.height, 0)

/** Inicio de cada capítulo en progreso 0–1. */
export const CHAPTER_STARTS: readonly number[] = CHAPTERS.reduce<number[]>((acc, _c, i) => {
  acc.push(i === 0 ? 0 : (acc[i - 1] ?? 0) + (CHAPTERS[i - 1]?.height ?? 0) / TOTAL)
  return acc
}, [])

/** Altura total de la historia en pantallas (para el CSS). */
export const STORY_SCREENS = TOTAL

export type SceneState = {
  chapter: number
  /** Progreso dentro del capítulo, 0–1. */
  local: number
  /** Índices en SHAPES de las formas de origen y destino. */
  from: number
  to: number
  /** Mezcla entre forma de origen y destino, 0–1. */
  mix: number
  /** Viento sobre el jardín (fuerte con lluvia). */
  wind: number
  /** Progreso de la formación del ramo (0–1): null antes de su capítulo. */
  assemble: number | null
  /** El ramo de luz se convierte en ramo real (0–1): al empezar la contemplación. */
  real: number
  /** Turbulencia curl-noise: sube a mitad de cada transformación. */
  turbulence: number
  /** Paleta del cielo (0 noche · 1 lluvia · 2 amanecer · 3 hora dorada), continua. */
  sky: number
  /** true en el capítulo final: el ramo se puede girar. */
  interactive: boolean
  /** Progreso del recorrido de cámara (0–1) en el capítulo de contemplación; si no, null. */
  tour: number | null
  camera: CameraKey
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function sceneAt(progress: number): SceneState {
  const p = clamp01(progress)
  let chapter = 0
  for (let i = 0; i < CHAPTER_STARTS.length; i++) if (p >= (CHAPTER_STARTS[i] ?? 0)) chapter = i
  const cur = CHAPTERS[chapter] ?? CHAPTERS[0]
  const prev = CHAPTERS[Math.max(0, chapter - 1)] ?? cur
  const start = CHAPTER_STARTS[chapter] ?? 0
  const len = cur.height / TOTAL
  const local = clamp01((p - start) / len)

  const from = SHAPES.indexOf(chapter === 0 ? cur.shape : prev.shape)
  const to = SHAPES.indexOf(cur.shape)
  const mix = cur.morph > 0 ? smooth(clamp01(local / cur.morph)) : 1

  const skyMix = smooth(clamp01(local / 0.6))
  const camMix = smooth(clamp01(local / 0.7))
  const camA = CAMERAS[Math.max(0, chapter - 1)] ?? CAMERAS[0]!
  const camB = CAMERAS[chapter] ?? camA
  const camera: CameraKey = {
    x: lerp(camA.x, camB.x, camMix),
    y: lerp(camA.y, camB.y, camMix),
    z: lerp(camA.z, camB.z, camMix),
    tx: lerp(camA.tx, camB.tx, camMix),
    ty: lerp(camA.ty, camB.ty, camMix),
    tz: lerp(camA.tz, camB.tz, camMix),
  }

  const ramo = CHAPTERS.findIndex((c) => c.id === 'ramo')
  return {
    chapter,
    local,
    from,
    to,
    mix,
    wind: lerp(chapter === 0 ? cur.wind : prev.wind, cur.wind, skyMix),
    assemble: chapter < ramo ? null : chapter === ramo ? local : 1,
    real: cur.id === 'final' ? 1 : cur.id === 'contemplar' ? smooth(clamp01(local / 0.16)) : 0,
    turbulence: from === to ? 0.05 : 0.08 + 0.35 * Math.sin(mix * Math.PI),
    sky: lerp(chapter === 0 ? cur.sky : prev.sky, cur.sky, skyMix),
    interactive: cur.id === 'final',
    tour: cur.id === 'contemplar' ? local : null,
    camera,
  }
}

// ---------------------------------------------------------------------------
// El ramo flor a flor
// ---------------------------------------------------------------------------

/** Vuelo de la flor que sale en el puesto `order` de `count` (0–1), según el avance del capítulo. */
export function liftFor(assemble: number, order: number, count: number): number {
  const start = 0.04 + (count > 1 ? order / (count - 1) : 0) * 0.56
  return smooth(clamp01((assemble - start) / 0.22))
}

/** La flor 3D aparece cuando su cometa de partículas aterriza. */
export const flowerRevealFor = (lift: number): number => smooth(clamp01((lift - 0.8) / 0.2))

/** Papel, seda, follaje y lazo: cuando ya han llegado todas las flores. */
export const wrapFor = (assemble: number): number => smooth(clamp01((assemble - 0.84) / 0.12))
