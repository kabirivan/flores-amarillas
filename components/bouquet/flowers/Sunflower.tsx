'use client'

import * as m from 'motion/react-m'
import { useMemo } from 'react'
import type { Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { bloomTiming, SPRING } from '@/lib/sequence'
import { petalFill, useStage } from '../StageContext'
import { Petal } from '../Petal'
import { Calyx } from '../Calyx'
import { ORIGIN_BASE, ORIGIN_CENTER, reveal } from '../anim'

/** Girasol: la cabeza gira mientras se abre y los pétalos se estiran desde el centro. */
export function Sunflower({ flower }: { flower: Flower }) {
  const { bloom, timeline, count, uid } = useStage()
  const layout = flower.layout
  const timing = bloomTiming(flower.order, count, SPECIES.sunflower.bloom, timeline)

  const petals = useMemo(
    () => (layout.kind === 'rosette' ? layout.petals.slice().sort((a, b) => b.radius - a.radius) : []),
    [layout],
  )
  if (layout.kind !== 'rosette') return null

  return (
    <m.g
      style={ORIGIN_CENTER}
      {...reveal(
              bloom, { rotate: -80, scale: 0.3 }, { rotate: 0, scale: 1 }, { ...SPRING.bloom, delay: timing.delay })}
    >
      <Calyx flower={flower} count={14} length={layout.core.radius * 1.2 + 16} radius={layout.core.radius * 0.9} />
      {petals.map((p, i) => (
        <g key={i} transform={`rotate(${p.angle}) translate(0,${-p.radius})`}>
          <m.g
            style={ORIGIN_BASE}
            {...reveal(
              bloom,
              { scaleY: 0, scaleX: 0.3 },
              { scaleY: 1, scaleX: 1 },
              { ...SPRING.bloom, delay: timing.delay + p.t * timing.duration * 0.6 },
            )}
          >
            <Petal
              shape={p.shape}
              fill={petalFill(uid, flower.tone.index + p.shift)}
              shade={flower.tone.core}
              vein={p.radius > layout.core.radius * 0.6}
            />
          </m.g>
        </g>
      ))}
      <m.g
        style={ORIGIN_CENTER}
        {...reveal(
              bloom, { scale: 0 }, { scale: 1 }, { ...SPRING.bloom, delay: timing.delay })}
      >
        <circle r={layout.core.radius} fill={`url(#${uid}-core)`} />
        {layout.core.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#E8A33D" opacity={0.55} />
        ))}
      </m.g>
    </m.g>
  )
}
