'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export type OpeningPhase = 'idle' | 'playing' | 'done'

export type OpeningSequence = {
  phase: OpeningPhase
  /** Sube en cada reproducción; sirve de `key` para remontar lo animado. */
  run: number
  /** true si el sistema pide menos movimiento: se salta la coreografía. */
  reduced: boolean
  /** Marca de tiempo (performance.now) del último arranque, para sincronizar sonido y partículas. */
  startedAt: number | null
  start: () => void
  /** La última animación avisa de que ha terminado. */
  finish: () => void
}

/**
 * Máquina de estados de la apertura. Una sola fuente de tiempo: el resto de piezas lee
 * `lib/sequence.ts` y se programa con sus propios retrasos a partir del arranque.
 */
export function useOpeningSequence(total: number): OpeningSequence {
  const reduced = useReducedMotion() ?? false
  const [phase, setPhase] = useState<OpeningPhase>('idle')
  const [run, setRun] = useState(0)
  const startedAt = useRef<number | null>(null)

  const start = useCallback(() => {
    startedAt.current = performance.now()
    setRun((r) => r + 1)
    setPhase('playing')
  }, [])

  const finish = useCallback(() => {
    setPhase((p) => (p === 'playing' ? 'done' : p))
  }, [])

  // Red de seguridad. El final real lo marca la última animación al completarse: si la
  // pestaña se oculta, el navegador pausa las animaciones pero no los temporizadores, y
  // un setTimeout declararía terminado un ramo que aún no ha florecido.
  useEffect(() => {
    if (phase !== 'playing') return
    const ms = (reduced ? 1 : total + 4) * 1000
    const id = window.setTimeout(finish, ms)
    return () => window.clearTimeout(id)
  }, [phase, run, reduced, finish, total])

  return { phase, run, reduced, startedAt: startedAt.current, start, finish }
}
