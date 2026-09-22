'use client'

import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { generateBouquet } from '@/lib/bouquet'
import type { BouquetScene } from '@/lib/three/bouquetScene'
import { useMusic } from '@/hooks/useMusic'
import { SkyBackdrop } from '@/components/scene/SkyBackdrop'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { OpeningStage } from '@/components/opening/OpeningStage'
import { Finale } from './Finale'
import { Portada } from './Portada'
import styles from './Story.module.css'

/** El mismo ramo para todos los nombres (elegido por bonito: 21 girasoles). */
const BOUQUET_SEED = 'flores amarillas'

type Props = {
  name: string
  from: string
  message: string
  /** Arnés `?t=N`: salta la portada y congela el instante N (segundos). */
  seek?: number | null
}

/**
 * Solo el ramo: portada (el gesto desbloquea el sonido) → el ramo de girasoles de hilos se
 * dibuja sobre un jardín de líneas, llegan las mariposas y aparece la dedicatoria.
 */
export function BouquetExperience({ name, from, message, seek = null }: Props) {
  const bouquet = useMemo(() => generateBouquet(BOUQUET_SEED), [])
  const reduced = useReducedMotion() ?? false
  const music = useMusic()
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [started, setStarted] = useState(seek !== null)
  const [leaving, setLeaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BouquetScene | null>(null)

  useEffect(() => {
    // Precarga del motor mientras se lee la portada.
    void import('@/lib/three/bouquetScene')
    void import('@/lib/three/engine').then(({ supportsWebGL2 }) => setWebgl(supportsWebGL2()))
  }, [])

  useEffect(() => {
    if (!started || !webgl || !canvasRef.current) return
    let cancelled = false
    let scene: BouquetScene | null = null
    void import('@/lib/three/bouquetScene').then(({ createBouquetScene }) => {
      if (cancelled || !canvasRef.current) return
      scene = createBouquetScene(canvasRef.current, bouquet, { harness: seek !== null, reduced })
      sceneRef.current = scene
      if (seek !== null) scene.freeze(seek)
      else scene.start()
    })
    return () => {
      cancelled = true
      scene?.dispose()
      sceneRef.current = null
    }
  }, [started, webgl, bouquet, seek, reduced])

  // Paralaje con el cursor.
  useEffect(() => {
    if (!started || reduced || seek !== null) return
    const onMove = (e: PointerEvent) => sceneRef.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [started, reduced, seek])

  const start = () => {
    music.unlock()
    music.play([], bouquet.seed, 0)
    setLeaving(true)
    setStarted(true)
  }

  if (webgl === false) return <OpeningStage name={name} from={from} message={message} />

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className={styles.root}>
          <SkyBackdrop />
          <canvas ref={canvasRef} className={styles.canvas} data-ready={started} aria-hidden="true" />
          {seek === null ? <SoundToggle on={music.on} onToggle={music.toggle} /> : null}
          {seek === null ? <Portada name={name} from={from} leaving={leaving} animate={!reduced} onStart={start} /> : null}
          {started ? (
            <div className={styles.bouquetOverlay} data-instant={seek !== null || reduced}>
              <Finale name={name} from={from} message={message} height={1} onReplay={() => sceneRef.current?.start()} />
            </div>
          ) : null}
          <p className="visually-hidden">{`Un ramo de girasoles para ${name}, de ${from}.`}</p>
        </main>
      </LazyMotion>
    </MotionConfig>
  )
}
