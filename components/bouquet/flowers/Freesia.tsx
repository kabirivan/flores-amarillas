'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import type { PetalShape } from '@/lib/bouquet/geometry'
import { SPECIES } from '@/lib/bouquet/species'
import { GREENS } from '@/lib/bouquet/palette'
import { bloomTiming, SPRING, EASE } from '@/lib/sequence'
import { petalFill, useStage } from '../StageContext'
import { Petal } from '../Petal'
import { ORIGIN_BASE, draw, reveal } from '../anim'

/** Pétalos de la trompeta: dos detrás, abiertos; tres delante, más cerrados. */
const BACK: PetalShape = { length: 20, width: 7.5, waist: 0.7, base: 0.3, tip: 0.95, notch: 0 }
const FRONT: PetalShape = { length: 22, width: 7, waist: 0.68, base: 0.3, tip: 0.9, notch: 0 }
const BACK_SPLAY = [-52, 52] as const
const FRONT_SPLAY = [-22, 22, 0] as const

/**
 * Fresia: la espiga se traza y las campanas se abren de abajo arriba. Cada campana es una
 * trompeta: primero asoma cerrada y después abre sus cinco pétalos, con la garganta más
 * oscura al fondo. Las de la punta se quedan en capullo, como en la planta real.
 */
export function Freesia({ flower }: { flower: Flower }) {
  const { bloom, grow, timeline, count, uid } = useStage()
  const layout = flower.layout
  if (layout.kind !== 'spike') return null
  const timing = bloomTiming(flower.order, count, SPECIES.freesia.bloom, timeline)
  const tone = flower.tone.index

  return (
    <g>
      <m.path
        d={layout.spine}
        fill="none"
        stroke={GREENS.mid}
        strokeWidth={3}
        strokeLinecap="round"
        {...draw(grow, { duration: 0.5, ease: EASE.outQuint, delay: timing.delay - 0.2 })}
      />
      {layout.bells.map((b, i) => {
        const delay = timing.delay + (1 - b.t) * timing.duration * 0.8
        // La última campana (la de la punta) se queda en capullo.
        const isBud = i === layout.bells.length - 1
        return (
          <g key={i} transform={`translate(${b.x},${b.y}) rotate(${b.angle}) scale(${b.scale})`}>
            <m.g style={ORIGIN_BASE} {...reveal(
              bloom, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }, { ...SPRING.bloom, delay, opacity: { duration: 0.1, delay } })}>
              {isBud ? (
                <Petal shape={{ ...FRONT, width: 5, length: 18, tip: 0.3 }} fill={petalFill(uid, tone + b.shift - 1)} shade={GREENS.mid} />
              ) : (
                <>
                  {BACK_SPLAY.map((a, k) => (
                    <m.g key={`b${k}`} style={ORIGIN_BASE} {...reveal(
              bloom, { rotate: 0 }, { rotate: a }, { ...SPRING.bloom, delay: delay + 0.1 })}>
                      <Petal shape={{ ...BACK, bend: a > 0 ? 0.3 : -0.3 }} fill={petalFill(uid, tone + b.shift + 1)} shade={flower.tone.shade} />
                    </m.g>
                  ))}
                  {FRONT_SPLAY.map((a, k) => (
                    <m.g key={`f${k}`} style={ORIGIN_BASE} {...reveal(
              bloom, { rotate: 0 }, { rotate: a }, { ...SPRING.bloom, delay: delay + 0.16 })}>
                      <Petal shape={{ ...FRONT, bend: a / 90 }} fill={petalFill(uid, tone + b.shift)} shade={flower.tone.shade} vein />
                    </m.g>
                  ))}
                  {/* garganta */}
                  <ellipse cx={0} cy={-3} rx={3.4} ry={5} fill={flower.tone.shade} opacity={0.7} />
                </>
              )}
            </m.g>
          </g>
        )
      })}
    </g>
  )
}
