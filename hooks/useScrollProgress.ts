'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Progreso de la historia (0–1) según el scroll nativo del documento. Un capítulo cuenta
 * como activo cuando su sección cruza el centro de la pantalla. No provoca renders de
 * React: entrega el valor por callback (el motor 3D lo suaviza en su propio bucle).
 */
export function useScrollProgress(container: RefObject<HTMLElement | null>, enabled: boolean, onProgress: (p: number) => void) {
  useEffect(() => {
    const el = container.current
    if (!el || !enabled) return
    let raf = 0
    const measure = () => {
      raf = 0
      const rect = el.getBoundingClientRect()
      const p = (window.innerHeight * 0.5 - rect.top) / Math.max(1, rect.height)
      onProgress(Math.min(1, Math.max(0, p)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [container, enabled, onProgress])
}
