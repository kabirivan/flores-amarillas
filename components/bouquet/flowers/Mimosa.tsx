'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { GREENS, toneAt } from '@/lib/bouquet/palette'
import { bloomTiming, EASE } from '@/lib/sequence'
import { useStage } from '../StageContext'
import { ORIGIN_CENTER, draw, reveal } from '../anim'

/**
 * Mimosa: las ramitas se trazan y los pompones aparecen en racimo con un micro-rebote.
 * El borde esponjoso es un trazo punteado sobre el círculo: un solo elemento por pompón.
 */
export function Mimosa({ flower }: { flower: Flower }) {
  const { bloom, grow, timeline, count } = useStage()
  const layout = flower.layout
  if (layout.kind !== 'pompons') return null
  const timing = bloomTiming(flower.order, count, SPECIES.mimosa.bloom, timeline)

  return (
    <g>
      {layout.twigs.map((d, i) => (
        <m.path
          key={i}
          d={d}
          fill="none"
          stroke={GREENS.mid}
          strokeWidth={2}
          strokeLinecap="round"
          {...draw(grow, { duration: 0.45, ease: EASE.outQuint, delay: timing.delay - 0.15 })}
        />
      ))}
      {layout.florets.map((f, i) => {
        const tone = toneAt(flower.tone.index + f.shift)
        return (
          <m.g
            key={i}
            transform={`translate(${f.x},${f.y})`}
            {...reveal(
              bloom, { opacity: 0 }, { opacity: 1 }, { duration: 0.01, delay: timing.delay + f.t * timing.duration * 0.8 })}
          >
            <m.g
              style={ORIGIN_CENTER}
              {...reveal(
              bloom, { scale: 0 }, { scale: 1 }, { duration: 0.5, ease: EASE.backOut, delay: timing.delay + f.t * timing.duration * 0.8 })}
            >
              <circle r={f.r} fill={tone.base} stroke={tone.base} strokeWidth={3.2} strokeDasharray="0.1 2.6" strokeLinecap="round" />
              <circle cx={-f.r * 0.3} cy={-f.r * 0.3} r={f.r * 0.45} fill={tone.light} opacity={0.7} />
            </m.g>
          </m.g>
        )
      })}
    </g>
  )
}
