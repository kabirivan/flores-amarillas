'use client'

import { LazyMotion, domAnimation } from 'motion/react'
import { useId, useMemo, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { Bouquet, Flower } from '@/lib/bouquet/types'
import { SPECIES } from '@/lib/bouquet/species'
import { TIMELINES, settleTime, type Choreography } from '@/lib/sequence'
import { StageContext, type Stage } from './StageContext'
import { Defs } from './Defs'
import { Leaves, Stem } from './Stem'
import { Bow, WrapBack, WrapFront } from './Wrap'
import { FlowerHead } from './FlowerHead'
import { Seed } from './Seed'
import styles from './Bouquet.module.css'

type Props = {
  bouquet: Bouquet
  /** Reproducir la secuencia de apertura. false = estado final directamente. */
  animate?: boolean
  /** Coreografía de la apertura (si `animate`). */
  choreography?: Choreography
  /** Mecerse con el viento una vez abierto. */
  sway?: boolean
  /** Acceso al <svg> (para rasterizarlo). */
  svgRef?: Ref<SVGSVGElement>
  glow?: string
  label: string
  className?: string | undefined
}

/**
 * El ramo completo en un solo <svg>. Orden de pintado, de atrás adelante:
 * papel de seda → tallos → hojas → cabezas (por capa) → papel delantero → lazo.
 * Las cabezas van después de todos los tallos para que ningún tallo cruce una flor.
 */
export function BouquetSVG({
  bouquet,
  animate = false,
  choreography = 'garden',
  sway = true,
  svgRef,
  glow = '#FFC46B',
  label,
  className,
}: Props) {
  const rawId = useId()
  const uid = `fa${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const count = bouquet.flowers.length
  const timeline = TIMELINES[choreography]
  const stage = useMemo<Stage>(
    () => ({
      animate,
      grow: animate && choreography === 'garden',
      bloom: animate ? timeline.bloomAmount : 0,
      timeline,
      count,
      uid,
    }),
    [animate, choreography, timeline, count, uid],
  )
  const { view, bind } = bouquet

  // Variables de viento por flor: mismo giro para tallo, hojas y cabeza.
  const swayStyle = (f: Flower): CSSProperties | undefined => {
    if (!sway) return undefined
    const settle = animate
      ? settleTime(f.order, count, SPECIES[f.species].bloom, timeline)
      : -f.sway.phase * f.sway.duration
    return {
      '--ox': `${bind.x - view.x}px`,
      '--oy': `${bind.y - view.y}px`,
      '--dur': `${f.sway.duration}s`,
      '--amp': `${f.sway.amplitude}deg`,
      '--delay': `${settle}s`,
    } as CSSProperties
  }
  const layer = (f: Flower, children: ReactNode) =>
    sway ? (
      <g key={f.id} className={styles.sway} style={swayStyle(f)}>
        {children}
      </g>
    ) : (
      <g key={f.id}>{children}</g>
    )

  return (
    <LazyMotion features={domAnimation} strict>
      <StageContext.Provider value={stage}>
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMax meet"
          role="img"
          aria-label={label}
          className={className}
        >
          <Defs uid={uid} glow={glow} wrap={bouquet.wrap} />
          {/* Sombra del ramo sobre el suelo: lo ancla en la escena. */}
          <ellipse
            cx={bind.x}
            cy={bind.y + bouquet.wrap.shape.drop + 6}
            rx={bouquet.wrap.shape.spread * 0.9}
            ry={14}
            fill={`url(#${uid}-shadow)`}
          />
          <WrapBack wrap={bouquet.wrap} />
          <Seed bind={bind} />
          {bouquet.flowers.map((f) => layer(f, <Stem flower={f} />))}
          {bouquet.flowers.map((f) => layer(f, <Leaves flower={f} />))}
          {bouquet.flowers.map((f) => layer(f, <FlowerHead flower={f} />))}
          <WrapFront wrap={bouquet.wrap} />
          <Bow wrap={bouquet.wrap} />
        </svg>
      </StageContext.Provider>
    </LazyMotion>
  )
}
