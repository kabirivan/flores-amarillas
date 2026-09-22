'use client'

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { describeBouquet, generateBouquet } from '@/lib/bouquet'
import { ENVELOPE_LIFT, EASE, TIMELINES, bloomTiming } from '@/lib/sequence'
import { useOpeningSequence } from '@/hooks/useOpeningSequence'
import { useFitBox } from '@/hooks/useFitBox'
import { useParallax } from '@/hooks/useParallax'
import { useMusic } from '@/hooks/useMusic'
import { cuesFor, openingScore, CHORDS } from '@/lib/audio/score'
import { SPECIES } from '@/lib/bouquet/species'
import { BouquetSVG } from '@/components/bouquet/BouquetSVG'
import { SkyBackdrop } from '@/components/scene/SkyBackdrop'
import { Button } from '@/components/ui/Button'
import { SoundToggle } from '@/components/ui/SoundToggle'
import { Certificate } from './Certificate'
import { Envelope } from './Envelope'
import { HandwrittenName } from './HandwrittenName'
import styles from './OpeningStage.module.css'

type Props = { name: string; from: string; message: string }

const lengthClass = (name: string) => (name.length > 22 ? 'long' : name.length > 12 ? 'mid' : 'short')

/**
 * La apertura por tiempo (sin WebGL2): sobre → los tallos crecen y las flores se abren una
 * a una (coreografía de jardín) → ramo final. Es el respaldo de la historia 3D.
 * El ramo se genera aquí mismo a partir del nombre (es determinista), así el HTML no
 * tiene que llevar el objeto serializado.
 */
export function OpeningStage({ name, from, message }: Props) {
  const bouquet = useMemo(() => generateBouquet(name), [name])
  const label = useMemo(() => `Ramo de ${describeBouquet(bouquet)}, para ${name}.`, [bouquet, name])
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const fit = useFitBox(stageRef, bouquet.view)
  const timeline = TIMELINES.garden
  const { phase, run, reduced, start: startSequence, finish } = useOpeningSequence(timeline.total)
  const music = useMusic()

  /** La partitura de esta apertura: su melodía sale de la semilla del ramo. */
  const score = () => {
    if (reduced) {
      // Sin coreografía: solo el acorde de llegada y, después, el bucle ambiental.
      return {
        events: CHORDS.I.map((midi) => ({ t: 0, midi, dur: 4, vel: 0.5, voice: 'pad' as const })),
        ambientFrom: 3,
      }
    }
    const count = bouquet.flowers.length
    const blooms = bouquet.flowers
      .map((f) => bloomTiming(f.order, count, SPECIES[f.species].bloom, timeline).delay)
      .sort((a, b) => a - b)
    return { events: openingScore(bouquet.seed, cuesFor(timeline, blooms)), ambientFrom: timeline.total }
  }

  const start = () => {
    // El audio solo puede arrancar dentro del gesto.
    music.unlock()
    startSequence()
    const { events, ambientFrom } = score()
    music.play(events, bouquet.seed, ambientFrom)
  }

  // El sobre flota sobre el punto de atado: de ahí cae la semilla.
  const { bind } = bouquet
  const core = fit?.toPx({ x: bind.x, y: bind.y - ENVELOPE_LIFT }) ?? null
  const envelopeAt = fit && core ? { x: core.x, y: core.y, width: Math.min(320, Math.max(180, 250 * fit.scale)) } : null

  // Al abrir (o repetir), el foco pasa al título final: el botón que se pulsó desaparece.
  useEffect(() => {
    if (run > 0) headingRef.current?.focus({ preventScroll: true })
  }, [run])

  const idle = phase === 'idle'
  const animate = !reduced
  useParallax(mainRef, animate)
  const at = (t: number) => (animate ? t : 0)
  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: animate ? 8 : 0 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: animate ? 0.6 : 0.2, ease: EASE.outExpo, delay: at(delay) },
  })

  const words = message.split(/(\s+)/)
  const wordStep = Math.min(0.04, 0.6 / Math.max(1, words.length))
  const { text } = timeline

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <main ref={mainRef} className={styles.main} data-phase={phase}>
          <SkyBackdrop />
          <SoundToggle on={music.on} onToggle={music.toggle} />

          <div ref={stageRef} className={styles.stage}>
            {/* Capa de profundidad: el ramo se desplaza con el paralaje. */}
            <div className={styles.depth}>
              {!idle ? (
                <m.div
                  key={`ramo-${run}`}
                  className={styles.layer}
                  initial={{ opacity: animate ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <BouquetSVG bouquet={bouquet} animate={animate} choreography="garden" label={label} className={styles.bouquet} />
                </m.div>
              ) : null}
              {phase !== 'done' ? (
                <Envelope key={`sobre-${run}`} state={idle ? 'closed' : 'open'} breathe={animate} place={envelopeAt} />
              ) : null}
            </div>
          </div>

          <div className={styles.card}>
            {/* Antes de abrir */}
            <section className={styles.panel} data-visible={idle} inert={!idle}>
              <h1 className={styles.heading}>
                <span className="visually-hidden">Para {name}</span>
                <HandwrittenName name={name} delay={0.35} write={animate} className={styles.name} data-length={lengthClass(name)} />
              </h1>
              <p className={styles.lede}>{from ? `${from} te dejó algo` : 'Alguien te dejó algo'}</p>
              <Button className={styles.openButton} onClick={start} aria-label={`Abrir el regalo para ${name}`}>
                Abrir <span aria-hidden="true">✧</span>
              </Button>
            </section>

            {/* Después: se remonta en cada reproducción para reiniciar los retrasos. */}
            <section key={`final-${run}`} className={styles.panel} data-visible={!idle} inert={idle}>
              {!idle ? (
                <>
                  <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
                    <m.span className={styles.forWord} {...reveal(text.start)}>
                      Para
                    </m.span>
                    <span className="visually-hidden"> {name}</span>
                    <HandwrittenName
                      name={name}
                      delay={at(text.start + 0.1)}
                      budget={0.9}
                      write={animate}
                      className={styles.name}
                      data-length={lengthClass(name)}
                    />
                  </h1>
                  {message ? (
                    <p className={styles.message}>
                      {words.map((w, i) =>
                        /^\s+$/.test(w) || w === '' ? (
                          <Fragment key={i}>{w}</Fragment>
                        ) : (
                          <m.span key={i} className={styles.word} {...reveal(text.start + 0.35 + i * wordStep)}>
                            {w}
                          </m.span>
                        ),
                      )}
                    </p>
                  ) : null}
                  {from ? (
                    <m.p className={styles.from} {...reveal(text.start + 0.7)}>
                      — {from}
                    </m.p>
                  ) : null}
                  {/* El certificado es lo último en aparecer: su final cierra la secuencia. */}
                  <m.div {...reveal(timeline.certificate)} onAnimationComplete={finish}>
                    <Certificate bouquet={bouquet} name={name} />
                  </m.div>
                </>
              ) : null}
              <div className={styles.actions}>
                {phase === 'done' ? (
                  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    <Button variant="ghost" onClick={start}>
                      Ver otra vez
                    </Button>
                  </m.div>
                ) : null}
              </div>
            </section>
          </div>

          <p className="visually-hidden" aria-live="polite">
            {phase === 'done' ? `Se ha abierto tu ramo. ${label}` : ''}
          </p>
        </main>
      </LazyMotion>
    </MotionConfig>
  )
}
