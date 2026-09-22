'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createMusic, type MusicEngine } from '@/lib/audio/music'
import type { NoteEvent } from '@/lib/audio/score'

const KEY = 'fa:musica'

/**
 * La música de la apertura: preferencia recordada, pausa con la pestaña oculta y
 * desbloqueo dentro del gesto de «Abrir». Por defecto suena; el botón la silencia.
 */
export function useMusic() {
  const engine = useRef<MusicEngine | null>(null)
  const [on, setOn] = useState(true)

  // Preferencia guardada (puede fallar en modo privado: se ignora).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === 'off') setOn(false)
    } catch {}
  }, [])

  useEffect(() => {
    engine.current?.setMuted(!on)
    try {
      window.localStorage.setItem(KEY, on ? 'on' : 'off')
    } catch {}
  }, [on])

  // Con la pestaña oculta el audio se pausa; al volver, sigue donde iba.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) engine.current?.suspend()
      else engine.current?.resume()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      engine.current?.dispose()
      engine.current = null
    }
  }, [])

  /** Llamar de forma síncrona dentro del clic: crea el contexto de audio. */
  const unlock = useCallback(() => {
    if (!engine.current) {
      engine.current = createMusic()
      engine.current.setMuted(!on)
    }
    engine.current.unlock()
  }, [on])

  const play = useCallback((events: NoteEvent[], seed: string, ambientFrom: number) => {
    engine.current?.play(events, seed, ambientFrom)
  }, [])

  const cue = useCallback((events: NoteEvent[]) => engine.current?.cue(events), [])
  const setRain = useCallback((level: number) => engine.current?.setRain(level), [])
  const toggle = useCallback(() => setOn((v) => !v), [])

  return { on, toggle, unlock, play, cue, setRain }
}
