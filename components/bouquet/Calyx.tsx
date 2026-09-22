'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { petalPath } from '@/lib/bouquet/geometry'
import { GREENS } from '@/lib/bouquet/palette'
import { SPECIES } from '@/lib/bouquet/species'
import { bloomTiming, budTiming, SPRING } from '@/lib/sequence'
import { useStage } from './StageContext'
import { ORIGIN_CENTER, reveal } from './anim'

/**
 * Cáliz: la corona de sépalos verdes detrás de los pétalos. Se abre cuando revienta el
 * capullo, así la flor parece salir de él. Entre pétalo y pétalo asoma una punta verde.
 */
export function Calyx({ flower, count: sepals, length, radius }: { flower: Flower; count: number; length: number; radius: number }) {
  const { bloom, grow, timeline, count } = useStage()
  const speciesBloom = SPECIES[flower.species].bloom
  const burst = grow
    ? budTiming(flower.order, count, speciesBloom).burst
    : bloomTiming(flower.order, count, speciesBloom, timeline).delay + 0.1
  const d = petalPath({ length, width: length * 0.24, waist: 0.35, base: 0.6, tip: 0.05, notch: 0 })

  return (
    <m.g
      style={ORIGIN_CENTER}
      {...reveal(
        bloom,
        { scale: 0.3, rotate: -20, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1 },
        { ...SPRING.leaf, delay: burst - 0.1, opacity: { duration: 0.15, delay: burst - 0.1 } },
      )}
    >
      {Array.from({ length: sepals }, (_, i) => (
        <path
          key={i}
          d={d}
          transform={`rotate(${(360 / sepals) * i + 180 / sepals}) translate(0,${-radius})`}
          fill={i % 2 ? GREENS.mid : GREENS.deep}
        />
      ))}
    </m.g>
  )
}
