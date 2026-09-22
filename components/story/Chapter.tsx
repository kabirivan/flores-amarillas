'use client'

import * as m from 'motion/react-m'
import { useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import type { Chapter as ChapterData } from './story'
import styles from './Story.module.css'

/**
 * Un capítulo: una sección alta con su frase pegada al centro de la pantalla. La frase
 * aparece y se va según el scroll (opacidad y desplazamiento: solo compositor).
 */
export function Chapter({ chapter, height, reduced }: { chapter: ChapterData; height: number; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0.18, 0.36, 0.64, 0.82], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.18, 0.82], [40, -40])

  return (
    <section ref={ref} className={styles.chapter} style={{ height: `${height * 100}svh` }} aria-labelledby={`cap-${chapter.id}`}>
      <div className={styles.sticky}>
        <m.p id={`cap-${chapter.id}`} className={styles.line} style={reduced ? {} : { opacity, y }}>
          {chapter.line.map((seg, i) =>
            seg.name ? (
              <span key={i} className={styles.name}>
                {seg.text}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </m.p>
      </div>
    </section>
  )
}
