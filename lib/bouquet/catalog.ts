/**
 * Catálogo de ramos de la portada: diez ramos de flores amarillas, cada uno con sus especies
 * y cantidades. Cada ramo se dibuja en hilos (lib/three/bouquet3d/strands.ts) y tiene su
 * propia página, /ramo/{id}.
 */

import { createRng } from './prng'
import type { Species } from './species'

/** Cómo se dibuja cada flor en hilos. */
export type LineKind = 'sunflower' | 'rose' | 'tulip' | 'daisy' | 'gerbera' | 'mimosa' | 'freesia'

export type Ramo = {
  id: string
  name: string
  /** Una frase corta para la tarjeta y la vista previa. */
  blurb: string
  flowers: readonly (readonly [LineKind, number])[]
}

export const RAMOS: readonly Ramo[] = [
  { id: 'girasoles', name: 'Girasoles', blurb: 'El clásico que siempre mira al sol.', flowers: [['sunflower', 12]] },
  { id: 'rosas-de-oro', name: 'Rosas de oro', blurb: 'Dos docenas de rosas amarillas.', flowers: [['rose', 24]] },
  { id: 'tulipanes', name: 'Tulipanes', blurb: 'Quince tulipanes de primavera.', flowers: [['tulip', 15]] },
  { id: 'margaritas', name: 'Margaritas', blurb: 'Veinte margaritas soleadas.', flowers: [['daisy', 20]] },
  { id: 'gerberas', name: 'Gerberas', blurb: 'Nueve gerberas que sonríen.', flowers: [['gerbera', 9]] },
  { id: 'mimosa', name: 'Nube de mimosa', blurb: 'Ramitas de mimosa con girasoles.', flowers: [['mimosa', 10], ['sunflower', 3]] },
  { id: 'fresias', name: 'Fresias', blurb: 'Catorce fresias perfumadas.', flowers: [['freesia', 14]] },
  { id: 'girasoles-y-rosas', name: 'Girasoles y rosas', blurb: 'Siete girasoles entre doce rosas.', flowers: [['sunflower', 7], ['rose', 12]] },
  {
    id: 'jardin-amarillo',
    name: 'Jardín amarillo',
    blurb: 'Un poco de todo lo amarillo.',
    flowers: [['sunflower', 3], ['rose', 4], ['tulip', 4], ['daisy', 4], ['gerbera', 2], ['mimosa', 2], ['freesia', 2]],
  },
  { id: 'gran-ramo', name: 'Gran ramo de girasoles', blurb: 'Veintiún girasoles, el más grande.', flowers: [['sunflower', 21]] },
]

/** El ramo de los enlaces /para/… y del botón de la portada. */
export const DEFAULT_RAMO = 'gran-ramo'

export const ramoById = (id: string): Ramo | undefined => RAMOS.find((r) => r.id === id)

export const flowerTotal = (r: Ramo): number => r.flowers.reduce((n, [, c]) => n + c, 0)

/** La especie del generador (su forma de base) para cada tipo de flor en hilos. */
const BASE: Record<LineKind, Species> = {
  sunflower: 'sunflower',
  rose: 'tulip',
  tulip: 'tulip',
  daisy: 'daisy',
  gerbera: 'daisy',
  mimosa: 'mimosa',
  freesia: 'freesia',
}

/** Las flores del ramo, mezcladas (siempre igual para el mismo ramo). */
export function ramoKinds(r: Ramo): LineKind[] {
  const all = r.flowers.flatMap(([k, n]) => Array.from({ length: n }, () => k))
  return createRng(`catalogo:${r.id}`).shuffle(all)
}

export const baseSpecies = (kinds: readonly LineKind[]): Species[] => kinds.map((k) => BASE[k])

const NAMES: Record<LineKind, readonly [string, string]> = {
  sunflower: ['girasol', 'girasoles'],
  rose: ['rosa', 'rosas'],
  tulip: ['tulipán', 'tulipanes'],
  daisy: ['margarita', 'margaritas'],
  gerbera: ['gerbera', 'gerberas'],
  mimosa: ['ramita de mimosa', 'ramitas de mimosa'],
  freesia: ['fresia', 'fresias'],
}

/** «7 girasoles · 12 rosas». */
export const describeRamo = (r: Ramo): string => r.flowers.map(([k, n]) => `${n} ${NAMES[k][n === 1 ? 0 : 1]}`).join(' · ')
