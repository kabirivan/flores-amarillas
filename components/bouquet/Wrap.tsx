'use client'

import * as m from 'motion/react-m'
import type { Wrap as WrapData } from '@/lib/bouquet/types'
import {
  bowPath,
  ribbonTailsPath,
  wrapFoldPath,
  wrapInnerPath,
  wrapOverlapShadowPath,
  wrapPanelPath,
} from '@/lib/bouquet/geometry'
import { EASE, GARDEN, SPRING } from '@/lib/sequence'
import { useStage } from './StageContext'
import { ORIGIN_BASE, ORIGIN_CENTER, reveal } from './anim'

/** Papel de seda interior: sube por detrás de los tallos con su borde festoneado. */
export function WrapBack({ wrap }: { wrap: WrapData }) {
  const { grow: animate, uid } = useStage()
  return (
    <m.path
      d={wrapInnerPath(wrap.shape, wrap.scallops)}
      fill={`url(#${uid}-tissue)`}
      style={ORIGIN_BASE}
      {...reveal(animate, { scaleY: 0.3, opacity: 0 }, { scaleY: 1, opacity: 1 }, { ...SPRING.wrap, delay: GARDEN.wrap.start - 0.1 })}
    />
  )
}

/**
 * Las dos hojas delanteras se cierran alrededor de los tallos girando sobre el pico, primero
 * la izquierda y después la derecha, que queda encima y le proyecta una sombra suave.
 */
export function WrapFront({ wrap }: { wrap: WrapData }) {
  const { grow: animate, uid } = useStage()
  const { start } = GARDEN.wrap
  // El pico es el origen del giro. En la caja de cada hoja cae casi en la esquina interior.
  const leftOrigin = { originX: 0.91, originY: 1 }
  const rightOrigin = { originX: 0.14, originY: 1 }

  return (
    <g>
      <m.g
        style={leftOrigin}
        {...reveal(animate, { rotate: -38, opacity: 0 }, { rotate: 0, opacity: 1 }, { ...SPRING.wrap, delay: start })}
      >
        <path d={wrapPanelPath(wrap.shape, -1)} fill={`url(#${uid}-paper-l)`} />
        {wrap.folds
          .filter((t) => t < 0.5)
          .map((t, i) => (
            <path key={i} d={wrapFoldPath(wrap.shape, t)} stroke={wrap.paper.edge} strokeWidth={1.1} opacity={0.45} />
          ))}
      </m.g>
      <m.g
        style={rightOrigin}
        {...reveal(animate, { rotate: 38, opacity: 0 }, { rotate: 0, opacity: 1 }, { ...SPRING.wrap, delay: start + 0.16 })}
      >
        <path d={wrapOverlapShadowPath(wrap.shape)} fill="#000" opacity={0.06} />
        <path d={wrapPanelPath(wrap.shape, 1)} fill={`url(#${uid}-paper-r)`} />
        {wrap.folds
          .filter((t) => t > 0.55)
          .map((t, i) => (
            <path key={i} d={wrapFoldPath(wrap.shape, t)} stroke={wrap.paper.edge} strokeWidth={1.1} opacity={0.4} />
          ))}
      </m.g>
    </g>
  )
}

/** Altura del lazo: en el cuello del cono, donde el papel se recoge. */
export function bowY(wrap: WrapData): number {
  return wrap.shape.bind.y + wrap.shape.drop * 0.46
}

/** El lazo: la cinta rodea el cuello, las colas caen y la lazada se anuda con un rebote. */
export function Bow({ wrap }: { wrap: WrapData }) {
  const { grow: animate, uid } = useStage()
  const { bind, drop, rise, spread } = wrap.shape
  const { start } = GARDEN.ribbon
  const y = bowY(wrap)
  // Semiancho del cono a esa altura, para que la cinta abrace el papel.
  const half = (spread * (bind.y + drop - y)) / (drop + rise)
  const band = 7

  return (
    <g transform={`translate(${bind.x},${y})`}>
      <m.path
        d={`M${-half - 1},${-band / 2}Q0,${band * 0.9} ${half + 1},${-band / 2}L${half + 1},${band / 2}Q0,${band * 1.9} ${-half - 1},${band / 2}Z`}
        fill={wrap.ribbon.base}
        style={ORIGIN_CENTER}
        {...reveal(animate, { scaleX: 0 }, { scaleX: 1 }, { duration: 0.35, ease: EASE.outQuint, delay: start })}
      />
      <g transform={`translate(0,${band * 0.7})`}>
        <m.path
          d={ribbonTailsPath(wrap.bowSize, wrap.bowLean)}
          fill={wrap.ribbon.shade}
          style={{ originX: 0.5, originY: 0 }}
          {...reveal(animate, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1 }, { duration: 0.45, ease: EASE.outQuint, delay: start + 0.2 })}
        />
        <m.g
          style={ORIGIN_CENTER}
          {...reveal(
            animate,
            { scale: 0, rotate: -40 },
            { scale: 1, rotate: 0 },
            { duration: 0.6, ease: EASE.backOut, delay: start + 0.28 },
          )}
        >
          <path d={bowPath(wrap.bowSize, wrap.bowLean)} fill={`url(#${uid}-ribbon)`} />
          <path d={bowPath(wrap.bowSize * 0.55, wrap.bowLean)} fill={wrap.ribbon.shade} opacity={0.35} />
          <ellipse rx={7.5} ry={6.5} fill={wrap.ribbon.shade} />
        </m.g>
      </g>
    </g>
  )
}
