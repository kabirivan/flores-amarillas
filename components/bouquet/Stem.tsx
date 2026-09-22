'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { leafPath, leafVeinPath } from '@/lib/bouquet/geometry'
import { EASE, SPRING, leafDelay, stemTiming } from '@/lib/sequence'
import { useStage } from './StageContext'
import { leafFill } from './Defs'
import { ORIGIN_BASE, draw, reveal } from './anim'

/** El tallo crece del atado a la cabeza trazándose con pathLength. */
export function Stem({ flower }: { flower: Flower }) {
  const { grow, count } = useStage()
  const { delay, duration } = stemTiming(flower.order, count)
  return (
    <m.path
      d={flower.stem.d}
      fill="none"
      stroke={flower.stem.color}
      strokeWidth={flower.stem.width}
      strokeLinecap="round"
      {...draw(grow, { duration, delay, ease: EASE.outQuint })}
    />
  )
}

/** Las hojas se despliegan desde su base cuando el tallo llega hasta ellas. */
export function Leaves({ flower }: { flower: Flower }) {
  const { grow, count, uid } = useStage()
  return (
    <>
      {flower.leaves.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.at.x},${leaf.at.y}) rotate(${leaf.angle})`}>
          <m.g
            style={ORIGIN_BASE}
            {...reveal(
              grow,
              { scale: 0, rotate: -leaf.side * 40 },
              { scale: 1, rotate: 0 },
              { ...SPRING.leaf, delay: leafDelay(flower.order, count, leaf.t) },
            )}
          >
            <path d={leafPath(leaf.length, leaf.width, leaf.curl)} fill={leafFill(uid, leaf.color)} />
            <path
              d={leafVeinPath(leaf.length, leaf.curl)}
              fill="none"
              stroke="#2F5D46"
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.55}
            />
          </m.g>
        </g>
      ))}
    </>
  )
}
