'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import styles from './HandwrittenName.module.css'

type Box = { x: number; y: number; width: number; height: number }

type Props = {
  name: string
  /** Segundos antes de la primera letra. */
  delay?: number
  /** Duración máxima de toda la escritura, para que un nombre largo no se eternice. */
  budget?: number
  /** false = el nombre aparece ya escrito. */
  write?: boolean
  className?: string | undefined
  /** Tamaño según el largo del nombre ('short' | 'mid' | 'long'). */
  'data-length'?: string
}

const segmenter = typeof Intl !== 'undefined' ? new Intl.Segmenter('es', { granularity: 'grapheme' }) : null
const graphemes = (text: string): string[] =>
  segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)

/**
 * El nombre escrito a mano, letra por letra. Es texto SVG real (se puede seleccionar,
 * lo leen los lectores de pantalla y usa la fuente manuscrita), y el encuadre se ajusta
 * midiendo el texto una vez cargada la fuente.
 */
export function HandwrittenName({ name, delay = 0, budget = 1.2, write = true, className, ...rest }: Props) {
  const letters = useMemo(() => graphemes(name), [name])
  const textRef = useRef<SVGTextElement>(null)
  const [box, setBox] = useState<Box | null>(null)

  useLayoutEffect(() => {
    let alive = true
    const measure = () => {
      const el = textRef.current
      if (!el || !alive) return
      const b = el.getBBox()
      if (b.width > 0) setBox({ x: b.x, y: b.y, width: b.width, height: b.height })
    }
    measure()
    // La fuente puede llegar después del primer pintado: se vuelve a medir.
    void document.fonts?.ready.then(measure)
    return () => {
      alive = false
    }
  }, [name])

  // Las letras se solapan: cada una empieza antes de que termine la anterior.
  const step = Math.min(0.11, budget / Math.max(1, letters.length))
  const pad = 14
  const viewBox = box
    ? `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`
    : '0 -90 600 130'

  return (
    <svg
      className={[styles.svg, className].filter(Boolean).join(' ')}
      viewBox={viewBox}
      data-ready={box ? 'true' : 'false'}
      data-length={rest['data-length']}
      aria-hidden="true"
      focusable="false"
    >
      <text ref={textRef} className={styles.text} x={0} y={0}>
        {letters.map((ch, i) => {
          const d = delay + i * step
          const style = write
            ? ({ animationDelay: `${d}s, ${d + 0.32}s`, '--write': `${Math.max(0.5, step * 6)}s` } as CSSProperties)
            : undefined
          return (
            <tspan key={i} className={write && box ? styles.letter : undefined} style={box ? style : undefined}>
              {ch}
            </tspan>
          )
        })}
      </text>
    </svg>
  )
}
