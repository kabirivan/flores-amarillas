'use client'

import { createContext, useContext } from 'react'
import { TIMELINES, type Timeline } from '@/lib/sequence'

export type Stage = {
  /** false = se pinta directamente el estado final (vista previa, reduced motion, export). */
  animate: boolean
  /** true solo en la coreografía de jardín: tallos, hojas, capullos y papel se animan. */
  grow: boolean
  /** Cuánto del gesto de floración se anima (0 = nada). */
  bloom: number
  timeline: Timeline
  /** Número de flores del ramo; los tiempos de la cascada dependen de él. */
  count: number
  /** Prefijo de ids para que varios ramos en una página no compartan degradados. */
  uid: string
}

export const StageContext = createContext<Stage>({
  animate: false,
  grow: false,
  bloom: 0,
  timeline: TIMELINES.garden,
  count: 7,
  uid: 'fa',
})

export const useStage = (): Stage => useContext(StageContext)

/** Id de degradado de pétalo para una posición de la rampa. */
export const petalFill = (uid: string, index: number): string =>
  `url(#${uid}-p${Math.max(0, Math.min(6, Math.round(index)))})`
