'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { petalPath, type PetalShape } from '@/lib/bouquet/geometry'
import { GREENS } from '@/lib/bouquet/palette'
import { SPECIES } from '@/lib/bouquet/species'
import { budTiming } from '@/lib/sequence'
import { useStage } from './StageContext'
import { ORIGIN_BASE } from './anim'

const SHAPES: Partial<Record<Flower['species'], PetalShape>> = {
  sunflower: { length: 26, width: 13, waist: 0.5, base: 0.75, tip: 0.3, notch: 0 },
  daisy: { length: 16, width: 8, waist: 0.5, base: 0.7, tip: 0.3, notch: 0 },
  tulip: { length: 40, width: 12, waist: 0.42, base: 0.4, tip: 0.12, notch: 0 },
}

/**
 * El capullo: aparece en la punta del tallo cuando este casi ha terminado de crecer, se
 * hincha un poco y revienta al empezar la floración. Solo existe durante la apertura.
 */
export function Bud({ flower }: { flower: Flower }) {
  const { grow, count, uid } = useStage()
  const shape = SHAPES[flower.species]
  if (!grow || !shape) return null

  const { appear, burst } = budTiming(flower.order, count, SPECIES[flower.species].bloom)
  const total = burst + 0.3 - appear
  const grown = Math.min(0.45, (burst - appear) * 0.6) / total
  const swell = (burst - appear) / total

  return (
    <m.g
      style={ORIGIN_BASE}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: [0, 1, 1.1, 1.35], opacity: [1, 1, 1, 0] }}
      transition={{ duration: total, delay: appear, times: [0, grown, swell, 1], ease: 'easeOut' }}
    >
      <path d={petalPath(shape)} fill={`url(#${uid}-bud)`} />
      <path
        d={petalPath({ ...shape, width: shape.width * 0.45, length: shape.length * 0.9, bend: 0.25 })}
        fill={GREENS.deep}
        opacity={0.35}
      />
    </m.g>
  )
}
