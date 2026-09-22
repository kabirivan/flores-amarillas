'use client'

import * as m from 'motion/react-m'
import type { Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { bloomTiming } from '@/lib/sequence'
import { FLOWER_COMPONENTS } from './flowers'
import { useStage } from './StageContext'
import { Bud } from './Bud'
import { reveal } from './anim'

/**
 * Coloca la cabeza de una flor sobre su tallo con el halo de luz detrás. El capullo va
 * orientado según el tallo (lean); la flor abierta, según su propio giro (spin).
 */
export function FlowerHead({ flower }: { flower: Flower }) {
  const { bloom, timeline, count, uid } = useStage()
  const Species = FLOWER_COMPONENTS[flower.species]
  const { delay } = bloomTiming(flower.order, count, SPECIES[flower.species].bloom, timeline)
  const { x, y } = flower.head

  return (
    <>
      <g transform={`translate(${x},${y}) scale(${flower.scale})`}>
        <m.circle
          r={flower.layout.radius * 1.7}
          fill={`url(#${uid}-halo)`}
          {...reveal(bloom, { opacity: 0 }, { opacity: 1 }, { duration: 1.2, delay: delay + 0.2 })}
        />
      </g>
      {/* Sombra de contacto: cae sobre las flores de detrás (ya pintadas), desplazada
          hacia abajo como si la luz viniera de arriba. Da volumen al ramo sin filtros. */}
      <ellipse
        cx={x + flower.reach * 0.08}
        cy={y + flower.reach * 0.16}
        rx={flower.reach * 0.95}
        ry={flower.reach * 0.8}
        fill={`url(#${uid}-shadow)`}
        opacity={0.55}
      />
      <g transform={`translate(${x},${y}) rotate(${flower.stem.lean}) scale(${flower.scale})`}>
        <Bud flower={flower} />
      </g>
      <g transform={`translate(${x},${y}) rotate(${flower.spin}) scale(${flower.scale})`}>
        <Species flower={flower} />
      </g>
    </>
  )
}
