/**
 * El jardín: dónde crece cada flor, de qué color es y cuál de las amarillas se convierte en
 * cada flor del ramo. Puro y determinista por semilla (como el ramo), sin Three.js.
 *
 * Mundo: suelo en y = GROUND, el jardín se extiende hacia el fondo (z negativa). El frente
 * central queda libre: ahí brota la semilla y se forma el ramo.
 */

import { createRng } from '@/lib/bouquet/prng'

export const GROUND = -3.2

export type GardenFlower = {
  x: number
  z: number
  /** Altura del tallo sobre el suelo. */
  height: number
  /** Radio de la cabeza abierta. */
  radius: number
  petals: number
  /** Color (0–1). Las amarillas, de la rampa dorada; las demás, apagadas. */
  color: readonly [number, number, number]
  yellow: boolean
  /** Índice de la flor del ramo en la que se convierte, o −1. */
  bouquet: number
  /** Retraso de su floración (0–1) dentro de su capítulo. */
  bloomAt: number
  /** Giro de la cabeza (rad). */
  tilt: number
}

export type GardenLayout = { flowers: GardenFlower[]; yellowCount: number }

/** Colores apagados del resto del jardín: dejan brillar a las amarillas. */
const MUTED: readonly (readonly [number, number, number])[] = [
  [0.78, 0.74, 0.95], // lila
  [0.95, 0.72, 0.8], // rosa pálido
  [0.92, 0.92, 0.98], // blanco luna
  [0.62, 0.78, 1], // azul cielo
]
const GOLDS: readonly (readonly [number, number, number])[] = [
  [1, 0.93, 0.55],
  [1, 0.85, 0.3],
  [1, 0.76, 0.2],
]

const FRONT_CLEAR = { x: 1.6, zMin: -1.2 }

export function gardenLayout(seed: string, total: number, bouquetCount: number): GardenLayout {
  const rng = createRng(`jardin:${seed}`)
  const flowers: GardenFlower[] = []
  // Muestreo por rechazo con distancia mínima (disco de Poisson sencillo): nada se solapa.
  const minDist = (z: number) => 0.55 + Math.max(0, -z) * 0.035
  let tries = 0
  while (flowers.length < total && tries < total * 60) {
    tries++
    const x = rng.range(-12, 12)
    const z = rng.range(-16, 3.5)
    // Borde del jardín: un óvalo; el frente central, libre para la semilla y el ramo.
    if ((x / 12) ** 2 + ((z + 6) / 9.5) ** 2 > 1) continue
    if (Math.abs(x) < FRONT_CLEAR.x && z > FRONT_CLEAR.zMin) continue
    if (flowers.some((f) => (f.x - x) ** 2 + (f.z - z) ** 2 < minDist(z) ** 2)) continue
    flowers.push({
      x,
      z,
      height: rng.range(0.7, 2),
      radius: rng.range(0.2, 0.34),
      petals: rng.int(5, 9),
      color: rng.pick(MUTED),
      yellow: false,
      bouquet: -1,
      bloomAt: rng.next(),
      tilt: rng.range(-0.4, 0.4),
    })
  }

  // Amarillas: una de cada cinco, con preferencia cerca del frente (más visibles).
  const yellowCount = Math.max(bouquetCount + 4, Math.round(flowers.length * 0.2))
  const byFront = flowers
    .map((f, i) => ({ i, score: f.z * 0.6 - Math.abs(f.x) * 0.25 + rng.range(-3, 3) }))
    .sort((a, b) => b.score - a.score)
  for (const { i } of byFront.slice(0, yellowCount)) {
    const f = flowers[i]!
    f.yellow = true
    f.color = rng.pick(GOLDS)
    f.height = rng.range(1.3, 2.4)
    f.radius = rng.range(0.34, 0.5)
    f.petals = rng.int(11, 16)
  }

  // Las que se convierten en el ramo: las amarillas más cercanas al centro del frente.
  const yellows = flowers
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.yellow)
    .sort((a, b) => Math.hypot(a.f.x, a.f.z) - Math.hypot(b.f.x, b.f.z))
  yellows.slice(0, bouquetCount).forEach(({ f }, k) => {
    f.bouquet = k
  })

  return { flowers, yellowCount: yellows.length }
}
