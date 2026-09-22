'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { bloomTiming, EASE, SPRING } from '@/lib/sequence'
import { petalFill, useStage } from '../StageContext'
import { Petal } from '../Petal'
import { Calyx } from '../Calyx'
import { ORIGIN_BASE, ORIGIN_CENTER, reveal } from '../anim'

/** Margarita: el botón aparece y los pétalos saltan en abanico, uno tras otro, con rebote. */
export function Daisy({ flower }: { flower: Flower }) {
  const { bloom, timeline, count, uid } = useStage()
  const layout = flower.layout
  if (layout.kind !== 'rosette') return null
  const timing = bloomTiming(flower.order, count, SPECIES.daisy.bloom, timeline)

  return (
    <g>
      <Calyx flower={flower} count={10} length={layout.core.radius + 8} radius={layout.core.radius * 0.8} />
      {layout.petals.map((p, i) => (
        <g key={i} transform={`rotate(${p.angle}) translate(0,${-p.radius})`}>
          <m.g
            style={ORIGIN_BASE}
            {...reveal(
              bloom,
              { scale: 0, rotate: -25 },
              { scale: 1, rotate: 0 },
              { duration: 0.55, ease: EASE.backOut, delay: timing.delay + 0.12 + p.t * timing.duration * 0.55 },
            )}
          >
            <Petal shape={p.shape} fill={petalFill(uid, flower.tone.index + p.shift)} shade={flower.tone.shade} vein />
          </m.g>
        </g>
      ))}
      <m.g
        style={ORIGIN_CENTER}
        {...reveal(
              bloom, { scale: 0 }, { scale: 1 }, { ...SPRING.bloom, delay: timing.delay })}
      >
        <circle r={layout.core.radius} fill={`url(#${uid}-core-daisy)`} />
        {layout.core.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r * 1.3} fill="#FFE45E" opacity={0.45} />
        ))}
      </m.g>
    </g>
  )
}
