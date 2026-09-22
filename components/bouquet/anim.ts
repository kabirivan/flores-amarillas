import type { Transition } from 'motion/react'

type Target = Record<string, number>

/**
 * Props de revelado. `amount` dice cuánto del recorrido se anima:
 * - 0 / false: se pinta ya en `to`, sin transición (vista previa, reduced motion).
 * - 1 / true: de `from` a `to` completo.
 * - entre medias: parte de un punto intermedio. La galaxia lo usa para que las flores,
 *   ya dibujadas por las partículas, hagan solo un último gesto de floración.
 */
export function reveal(amount: boolean | number, from: Target, to: Target, transition: Transition) {
  const k = amount === true ? 1 : amount === false ? 0 : amount
  if (k <= 0) return { initial: false as const, animate: to }
  const start: Target = {}
  for (const key of Object.keys(from)) {
    const a = from[key] ?? 0
    const b = to[key] ?? a
    start[key] = b + (a - b) * k
  }
  return { initial: start, animate: to, transition }
}

/**
 * Props para trazar un path con pathLength. Un path con pathLength 0 y extremos redondeados
 * pinta un punto: se mantiene invisible hasta el instante en que empieza a trazarse.
 */
export function draw(animate: boolean, { duration, delay, ease }: { duration: number; delay: number; ease?: readonly number[] }) {
  return animate
    ? {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: {
          pathLength: { duration, delay, ease: ease ? [...ease] : 'easeOut' },
          opacity: { duration: 0.01, delay },
        } as Transition,
      }
    : { initial: false as const, animate: { pathLength: 1, opacity: 1 } }
}

/** Origen de transformación en la base (centro inferior) de la caja del elemento. */
export const ORIGIN_BASE = { originX: 0.5, originY: 1 } as const
export const ORIGIN_CENTER = { originX: 0.5, originY: 0.5 } as const
