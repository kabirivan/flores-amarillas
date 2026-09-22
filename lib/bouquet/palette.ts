/**
 * "La hora dorada": el amarillo se comporta como fuente de luz sobre un cielo profundo.
 * Todos los colores del ramo salen de aquí; nada de hex sueltos en los componentes.
 */

/** Rampa amarilla, del limón al ámbar quemado. El índice 0 es el más claro. */
export const YELLOWS = [
  '#FFF8D6',
  '#FFEE93',
  '#FFE45E',
  '#FFD23F',
  '#FFB627',
  '#F0961F',
  '#D97706',
] as const

export type YellowIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Un tono de flor: claro para la punta del pétalo, base para el cuerpo, sombra para el pliegue. */
export type FlowerTone = {
  /** Índice en YELLOWS del color de cuerpo. */
  index: number
  light: string
  base: string
  shade: string
  /** Centro del capítulo, siempre más oscuro que el cuerpo. */
  core: string
}

const at = (i: number): string => YELLOWS[Math.max(0, Math.min(YELLOWS.length - 1, i))] as string

/** Deriva un tono coherente a partir de una posición en la rampa. */
export function toneAt(index: number): FlowerTone {
  const i = Math.max(0, Math.min(YELLOWS.length - 1, Math.round(index)))
  return {
    index: i,
    light: at(i - 2),
    base: at(i),
    shade: at(i + 2),
    core: CORES[Math.min(CORES.length - 1, Math.max(0, i - 2))] as string,
  }
}

/** Centros: marrones cálidos que siguen leyéndose como parte de la familia amarilla. */
const CORES = ['#E8A33D', '#D97706', '#B45309', '#8C4A12', '#6B3410'] as const

export const GREENS = {
  deep: '#2F5D46',
  mid: '#3E7C5A',
  light: '#6BA368',
  leafLight: '#7FB069',
} as const

export const PAPERS = [
  { name: 'crema', base: '#F7EDE2', fold: '#E6D6C3', edge: '#D9C4AC' },
  { name: 'kraft', base: '#E4D3BE', fold: '#D2BC9F', edge: '#BFA381' },
  { name: 'lino', base: '#F2E8DC', fold: '#DFD0BE', edge: '#CBB79E' },
] as const

export type Paper = (typeof PAPERS)[number]

/** Papel de seda interior: asoma por encima del envoltorio con el borde festoneado. */
export const TISSUES = [
  { name: 'vainilla', base: '#FFF1CC', shade: '#EBD9A8' },
  { name: 'melocotón', base: '#F8D9C4', shade: '#E4BBA0' },
  { name: 'lila', base: '#E6DCF0', shade: '#CBBCDC' },
] as const

export type Tissue = (typeof TISSUES)[number]

export const RIBBONS = [
  { name: 'granate', base: '#C96B6B', shade: '#A44E4E' },
  { name: 'dorado', base: '#D9A441', shade: '#B4832C' },
  { name: 'malva', base: '#A47EA6', shade: '#815F84' },
] as const

export type Ribbon = (typeof RIBBONS)[number]

export const INK = {
  primary: '#FDF6EC',
  secondary: '#BFB0CE',
  soil: '#2A1E2E',
} as const

/** Presets de cielo. El nombre es el que se usa como `data-sky` en el DOM. */
export const SKIES = {
  alba: { stops: ['#2B1B3D', '#7A4A5C', '#E8A87C'], glow: '#F7C59F' },
  dia: { stops: ['#243B63', '#4E7BA7', '#BFD4E6'], glow: '#FFF3D0' },
  atardecer: { stops: ['#1A1035', '#4A1F4E', '#B4456A', '#F2A25C'], glow: '#FFC46B' },
  noche: { stops: ['#080B1F', '#141A3A', '#2E1F4A'], glow: '#6E5A9E' },
} as const

export type SkyName = keyof typeof SKIES
