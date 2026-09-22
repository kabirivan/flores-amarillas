import type { Paper, Ribbon, Tissue, FlowerTone } from './palette'
import type { HeadLayout, Species } from './species'
import type { Point, WrapShape } from './geometry'

export type { Species, HeadLayout, FlowerTone, Point }

export type Leaf = {
  /** Posición a lo largo del tallo, 0 = atado, 1 = cabeza. */
  t: number
  /** Punto de inserción ya resuelto sobre la curva. */
  at: Point
  side: -1 | 1
  length: number
  width: number
  /** Grados absolutos (0 = hacia arriba). */
  angle: number
  curl: number
  color: string
}

export type Stem = {
  length: number
  /** Grados; negativo inclina a la izquierda. */
  lean: number
  bow: number
  width: number
  color: string
  /** Atributo `d` ya calculado, del atado a la cabeza. */
  d: string
}

export type Flower = {
  id: string
  species: Species
  /** Posición en la cascada de floración (0 = la primera). */
  order: number
  /** Orden de pintado: 0 = al fondo. */
  layer: number
  scale: number
  /** Giro de la cabeza en grados. */
  spin: number
  tone: FlowerTone
  head: Point
  stem: Stem
  leaves: Leaf[]
  layout: HeadLayout
  /** Radio máximo de la cabeza desde su centro, ya en unidades del lienzo (con escala). */
  reach: number
  /** Balanceo con el viento alrededor del atado. */
  sway: { duration: number; amplitude: number; phase: number }
}

export type Wrap = {
  paper: Paper
  tissue: Tissue
  ribbon: Ribbon
  /** Número de festones del papel de seda. */
  scallops: number
  shape: WrapShape
  /** Pliegues del papel, 0–1 a lo ancho de la boca. */
  folds: number[]
  /** Inclinación de la lazada, −1 a 1. */
  bowLean: number
  bowSize: number
}

export type Bouquet = {
  /** Texto normalizado del que sale todo. */
  seed: string
  /** Número del certificado, 1000–9999. */
  serial: number
  /** Flores en orden de pintado (fondo → frente). */
  flowers: Flower[]
  wrap: Wrap
  tally: Record<Species, number>
  bind: Point
  width: number
  height: number
  /** Encuadre ajustado a lo que realmente ocupa este ramo (para el viewBox). */
  view: Box
}

export type Box = { x: number; y: number; width: number; height: number }
