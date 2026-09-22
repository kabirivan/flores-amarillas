'use client'

import * as m from 'motion/react-m'
import { PAPERS, RIBBONS } from '@/lib/bouquet/palette'
import { ENVELOPE, EASE } from '@/lib/sequence'
import styles from './Envelope.module.css'

const PAPER = PAPERS[0]
const SEAL = RIBBONS[0]

type Props = {
  /** 'closed' en reposo, 'open' cuando empieza la apertura. */
  state: 'closed' | 'open'
  /** Respirar en reposo (desactivado con reduced motion). */
  breathe: boolean
  /** Centro del sobre en píxeles del escenario, y su ancho. Sin medir aún: posición por defecto. */
  place?: { x: number; y: number; width: number } | null
}

/**
 * Sobre crema con sello de cera. Al abrirse, la solapa gira sobre su borde superior en 3D
 * y el sobre se hunde hacia el horizonte mientras la semilla de luz cae al ramo.
 * Todo es transform + opacity sobre elementos HTML: lo compone la GPU.
 */
export function Envelope({ state, breathe, place }: Props) {
  const open = state === 'open'
  const { start, dur } = ENVELOPE

  return (
    <div
      className={styles.wrap}
      aria-hidden="true"
      style={place ? { left: place.x, top: place.y, width: place.width, bottom: 'auto' } : undefined}
    >
      <m.div
        className={styles.float}
        initial={{ y: 0, scale: 1, opacity: 1 }}
        animate={open ? { y: 60, scale: 0.86, opacity: 0 } : { y: 0, scale: 1, opacity: 1 }}
        transition={open ? { delay: start + 0.25, duration: 0.45, ease: EASE.inQuad } : { duration: 0.3 }}
      >
        {breathe && !open ? (
          <m.div
            className={styles.float}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <EnvelopeArt open={false} dur={dur} />
          </m.div>
        ) : (
          <div className={styles.float}>
            <EnvelopeArt open={open} dur={dur} />
          </div>
        )}
        <div className={styles.glow} />
      </m.div>
    </div>
  )
}

function EnvelopeArt({ open, dur }: { open: boolean; dur: number }) {
  return (
    <>
      <svg className={styles.body} viewBox="0 0 300 200">
        {/* interior, visible cuando la solapa se levanta */}
        <path d="M8,14 L150,112 L292,14 Z" fill={PAPER.edge} />
        {/* cuerpo */}
        <path d="M6,20 Q6,10 16,10 L150,108 L284,10 Q294,10 294,20 L294,184 Q294,194 284,194 L16,194 Q6,194 6,184 Z" fill={PAPER.base} />
        {/* pliegues inferiores */}
        <path d="M6,188 L128,100 M294,188 L172,100" stroke={PAPER.edge} strokeWidth={1.5} fill="none" opacity={0.7} />
        <path d="M10,192 L150,120 L290,192 Z" fill={PAPER.fold} opacity={0.55} />
      </svg>
      <m.svg
        className={styles.flap}
        viewBox="0 0 300 200"
        initial={{ rotateX: 0 }}
        animate={open ? { rotateX: 178 } : { rotateX: 0 }}
        transition={{ duration: dur, ease: EASE.outExpo }}
      >
        <path d="M6,16 Q6,10 14,10 L286,10 Q294,10 294,16 L158,116 Q150,122 142,116 Z" fill={PAPER.fold} />
        <path d="M14,12 L150,110 L286,12" stroke={PAPER.edge} strokeWidth={1.2} fill="none" opacity={0.6} />
        {/* sello de cera con una flor */}
        <g transform="translate(150,106)">
          <circle r="19" fill={SEAL.shade} />
          <circle r="16" fill={SEAL.base} />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-6.5" rx="3.6" ry="6" fill="#F3C9A8" opacity={0.85} transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill="#FFD23F" />
        </g>
      </m.svg>
    </>
  )
}
