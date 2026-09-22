'use client'

import * as m from 'motion/react-m'
import type { Point } from '@/lib/bouquet/types'
import { ENVELOPE_LIFT, EASE, GARDEN } from '@/lib/sequence'
import { useStage } from './StageContext'
import { ORIGIN_CENTER } from './anim'

/**
 * La semilla de luz: cae desde el sobre hasta el punto de atado, rebota un poco y
 * suelta un anillo de polvo luminoso. De ahí nacen los tallos. Solo existe en la apertura.
 */
export function Seed({ bind }: { bind: Point }) {
  const { grow, uid } = useStage()
  if (!grow) return null
  const { start, dur } = GARDEN.seed
  const land = start + dur

  return (
    <g transform={`translate(${bind.x},${bind.y})`} aria-hidden="true">
      <m.circle
        r={34}
        fill={`url(#${uid}-halo)`}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3.6, times: [0, 0.1, 0.8, 1], delay: start }}
      />
      <m.circle
        r={12}
        fill="none"
        stroke="#FFE45E"
        strokeWidth={2}
        style={ORIGIN_CENTER}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 0.4, 3.2], opacity: [0, 0.9, 0] }}
        transition={{ duration: 0.7, times: [0, 0.02, 1], ease: EASE.outQuint, delay: land }}
      />
      <m.circle
        r={6}
        fill="#FFF8D6"
        initial={{ y: -ENVELOPE_LIFT, opacity: 0 }}
        animate={{ y: [-ENVELOPE_LIFT, 0, -10, 0], opacity: [0, 1, 1, 1] }}
        transition={{ duration: dur + 0.25, times: [0, 0.55, 0.78, 1], ease: [EASE.inQuad, EASE.outQuint, EASE.inQuad], delay: start }}
      />
    </g>
  )
}
