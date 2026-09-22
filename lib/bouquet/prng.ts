/**
 * Generador de números pseudoaleatorios determinista.
 *
 * Todo el ramo se deriva de aquí: el mismo texto de semilla produce exactamente la
 * misma secuencia, en el servidor y en el navegador, hoy y dentro de un año. Sin esto
 * el enlace que compartes no sería estable.
 */

/** Hash de cadena a 128 bits (cyrb128). Cuatro semillas bien mezcladas. */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

/** Mulberry32: 32 bits de estado, distribución excelente para lo que necesitamos. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = {
  /** Flotante en [0, 1). */
  next(): number
  /** Flotante en [min, max). */
  range(min: number, max: number): number
  /** Entero en [min, max], ambos inclusive. */
  int(min: number, max: number): number
  /** Un elemento de la lista. La lista no puede estar vacía. */
  pick<T>(items: readonly T[]): T
  /** Un elemento según pesos relativos. Listas del mismo largo, no vacías. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T
  /** true con probabilidad p. */
  chance(p: number): boolean
  /** Normal aproximada (suma de 3 uniformes), recortada a ±3 desviaciones. */
  gauss(mean: number, sd: number): number
  /** Mezcla una copia de la lista (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[]
}

/** Construye un Rng a partir de cualquier texto de semilla. */
export function createRng(seedText: string): Rng {
  const [s] = cyrb128(seedText)
  const next = mulberry32(s)

  const rng: Rng = {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: lista vacía')
      const item = items[Math.floor(next() * items.length)]
      // El índice siempre cae dentro del rango; esto satisface a TypeScript.
      return item as T
    },
    weighted<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0) throw new Error('rng.weighted: lista vacía')
      if (items.length !== weights.length) {
        throw new Error('rng.weighted: pesos y elementos de distinto largo')
      }
      let total = 0
      for (const w of weights) total += w
      let roll = next() * total
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i] ?? 0
        if (roll <= 0) return items[i] as T
      }
      return items[items.length - 1] as T
    },
    chance: (p) => next() < p,
    gauss(mean, sd) {
      const sum = next() + next() + next()
      const normal = (sum - 1.5) / 0.5 // ~N(0, 1)
      return mean + Math.max(-3, Math.min(3, normal)) * sd
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = items.slice()
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const a = copy[i] as T
        const b = copy[j] as T
        copy[i] = b
        copy[j] = a
      }
      return copy
    },
  }

  return rng
}
