'use client'

import { LazyMotion, MotionConfig, domAnimation, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeBouquet, generateBouquet } from '@/lib/bouquet'
import { CHAPTERS, sceneAt } from '@/lib/three/timeline'
import type { StoryEngine } from '@/lib/three/engine'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { useMusic } from '@/hooks/useMusic'
import { chapterCue } from '@/lib/audio/score'
import { SkyBackdrop } from '@/components/scene/SkyBackdrop'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { OpeningStage } from '@/components/opening/OpeningStage'
import { Chapter } from './Chapter'
import { Finale } from './Finale'
import { Portada } from './Portada'
import { storyFor } from './story'
import styles from './Story.module.css'

type Props = {
  name: string
  from: string
  message: string
  /** Arnés `?p=N`: salta la portada y congela la historia en ese punto del scroll. */
  seek?: number | null
  /** Arnés `?rot=N`: ángulo del ramo en grados, para verificar el giro. */
  rotation?: number
}

/**
 * La historia contada con scroll. Portada (gesto que desbloquea audio y carga Three.js) →
 * capítulos con su frase → final con el ramo. Si el navegador no tiene WebGL2, se usa la
 * apertura anterior (sobre + ramo SVG), que no lo necesita.
 */
export function StoryExperience({ name, from, message, seek = null, rotation = 0 }: Props) {
  const bouquet = useMemo(() => generateBouquet(name), [name])
  const chapters = useMemo(() => storyFor(name), [name])
  const reduced = useReducedMotion() ?? false
  const music = useMusic()

  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [started, setStarted] = useState(seek !== null)
  const [leaving, setLeaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<StoryEngine | null>(null)

  useEffect(() => {
    void import('@/lib/three/engine').then(({ supportsWebGL2 }) => setWebgl(supportsWebGL2()))
  }, [])

  // Precarga de Three.js en reposo: al pulsar «Comenzar» ya está en caché.
  useEffect(() => {
    if (!webgl) return
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    idle(() => void import('@/lib/three/engine'))
  }, [webgl])

  // Mientras no empieza, la página no se desplaza: la portada es la puerta.
  useEffect(() => {
    document.documentElement.style.overflow = started ? '' : 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [started])

  // Crea el motor cuando la historia empieza.
  useEffect(() => {
    if (!started || !webgl || !canvasRef.current) return
    let cancelled = false
    let engine: StoryEngine | null = null
    void import('@/lib/three/engine').then(({ createStoryEngine }) => {
      if (cancelled || !canvasRef.current) return
      // El ramo es de líneas procedurales: no carga modelos 3D (ver lib/three/bouquet3d/models.ts).
      engine = createStoryEngine(canvasRef.current, bouquet, { harness: seek !== null })
      engineRef.current = engine

      // Arnés: sin scroll (las capturas de una capa fija tras un scroll programático
      // salen desplazadas); la frase del capítulo se muestra aparte.
      if (seek !== null && !cancelled) {
        engine.freeze(seek, 3, rotation)
        // El primer pintado del arnés es síncrono: sus métricas ya están disponibles.
        const st = engine.stats()
        console.info(`[flores] ${engine.quality.particles} partículas de jardín · ${engine.quality.bouquet} del ramo · ${st.calls} llamadas de dibujo · ${st.points} puntos dibujados`)
      } else if (reduced && !cancelled) {
        // Menos movimiento: la historia se lee sobre el jardín final, quieto.
        engine.freeze(0.97)
      }
    })
    return () => {
      cancelled = true
      engine?.dispose()
      engineRef.current = null
    }
  }, [started, webgl, bouquet, seek, rotation, reduced])

  // Sonido por capítulo: su motivo al llegar (solo avanzando) y lluvia en el capítulo 4.
  const lastChapter = useRef(-1)
  const { cue, setRain } = music
  const onProgress = useCallback(
    (p: number) => {
      engineRef.current?.setProgress(p)
      const { chapter } = sceneAt(p)
      if (chapter !== lastChapter.current) {
        if (chapter > lastChapter.current) cue(chapterCue(bouquet.seed, CHAPTERS[chapter]?.id ?? 'final'))
        setRain(CHAPTERS[chapter]?.id === 'lluvia' ? 1 : 0)
        lastChapter.current = chapter
      }
    },
    [cue, setRain, bouquet.seed],
  )
  useScrollProgress(storyRef, started && seek === null && !reduced, onProgress)

  // Paralaje de cámara con el cursor.
  useEffect(() => {
    if (!started || reduced || seek !== null) return
    const onMove = (e: PointerEvent) =>
      engineRef.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [started, reduced, seek])

  const start = () => {
    music.unlock()
    music.play([], bouquet.seed, 0)
    setLeaving(true)
    setStarted(true)
    window.scrollTo({ top: 0 })
  }

  const replay = () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })

  if (webgl === false) return <OpeningStage name={name} from={from} message={message} />

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main className={styles.root}>
          <SkyBackdrop />
          <canvas ref={canvasRef} className={styles.canvas} data-ready={started} aria-hidden="true" />
          {seek === null ? <SoundToggle on={music.on} onToggle={music.toggle} /> : null}

          {seek === null ? (
            <Portada name={name} from={from} leaving={leaving} animate={!reduced} onStart={start} />
          ) : null}

          {seek !== null ? (
            sceneAt(seek).interactive ? (
              <div className={styles.harness}>
                <Finale name={name} from={from} message={message} height={1} onReplay={replay} />
              </div>
            ) : (
              <HarnessLine chapters={chapters} p={seek} />
            )
          ) : null}

          <div
            ref={storyRef}
            className={styles.story}
            data-started={started}
            hidden={seek !== null}
            aria-label={`Una historia para ${name}`}
          >
            {CHAPTERS.map((ch) => {
              const line = chapters.find((c) => c.id === ch.id)
              if (line) return <Chapter key={ch.id} chapter={line} height={ch.height} reduced={reduced} />
              if (ch.id === 'final')
                return (
                  <Finale key={ch.id} name={name} from={from} message={message} height={ch.height} onReplay={replay} />
                )
              // Contemplación: sin frase; el scroll mueve la cámara alrededor del ramo.
              return <section key={ch.id} style={{ height: `${ch.height * 100}svh` }} aria-label="El ramo, de cerca y alrededor" />
            })}
          </div>

          <p className="visually-hidden">{`Al final de la historia: ramo de ${describeBouquet(bouquet)}.`}</p>

        </main>
      </LazyMotion>
    </MotionConfig>
  )
}

/** Arnés `?p=N`: la frase del capítulo activo, fija, sin depender del scroll. */
function HarnessLine({ chapters, p }: { chapters: ReturnType<typeof storyFor>; p: number }) {
  const chapter = chapters.find((c) => c.id === CHAPTERS[sceneAt(p).chapter]?.id)
  if (!chapter) return null
  return (
    <div className={styles.harness}>
      <p className={styles.line}>
        {chapter.line.map((seg, i) =>
          seg.name ? (
            <span key={i} className={styles.name}>
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
    </div>
  )
}
