'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { bloomTiming, SPRING } from '@/lib/sequence'
import { petalFill, useStage } from '../StageContext'
import { Petal } from '../Petal'
import { ORIGIN_BASE, reveal } from '../anim'

/**
 * Tulipán: sube como un capullo cerrado y los pétalos se separan desde el centro,
 * los de detrás hacia fuera y los de delante abriendo la copa.
 */
export function Tulip({ flower }: { flower: Flower }) {
  const { bloom, timeline, count, uid } = useStage()
  const layout = flower.layout
  if (layout.kind !== 'cup') return null
  const timing = bloomTiming(flower.order, count, SPECIES.tulip.bloom, timeline)

  return (
    <m.g
      style={ORIGIN_BASE}
      {...reveal(
              bloom,
        { scale: 0.2, y: 14, opacity: 0 },
        { scale: 1, y: 0, opacity: 1 },
        { ...SPRING.bloom, delay: timing.delay, opacity: { duration: 0.2, delay: timing.delay } },
      )}
    >
      {layout.back.map((p, i) => (
        <m.g
          key={`b${i}`}
          style={ORIGIN_BASE}
          {...reveal(
              bloom,
            { rotate: p.angle * 0.15 },
            { rotate: p.angle },
            { ...SPRING.bloom, delay: timing.delay + p.t * timing.duration },
          )}
        >
          <Petal shape={p.shape} fill={petalFill(uid, flower.tone.index + p.shift)} shade={flower.tone.core} vein />
        </m.g>
      ))}
      {layout.front.map((p, i) => (
        <m.g
          key={`f${i}`}
          style={ORIGIN_BASE}
          {...reveal(
              bloom,
            { rotate: 0, scaleX: 0.85 },
            { rotate: p.angle, scaleX: 1 },
            { ...SPRING.bloom, delay: timing.delay + p.t * timing.duration },
          )}
        >
          <Petal shape={p.shape} fill={petalFill(uid, flower.tone.index + p.shift)} shade={flower.tone.core} vein />
        </m.g>
      ))}
    </m.g>
  )
}
