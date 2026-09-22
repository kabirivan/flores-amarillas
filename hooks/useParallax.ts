'use client'

import { useEffect, useRef, type RefObject } from 'react'

export type Parallax = { x: number; y: number }

/**
 * Paralaje con el cursor. Sin renders de React: en cada fotograma escribe `--px` y `--py`
 * (de -1 a 1, suavizados) en el elemento raíz, y deja el mismo valor en un ref para el
 * lienzo de partículas. Las capas CSS solo usan transform: todo ocurre en el compositor.
 *
 * Se desactiva con reduced motion y en pantallas táctiles sin cursor (el giroscopio
 * llegará en la fase de interacciones). El bucle se duerme cuando el valor se asienta.
 */
export function useParallax(root: RefObject<HTMLElement | null>, enabled: boolean): RefObject<Parallax> {
  const value = useRef<Parallax>({ x: 0, y: 0 })

  useEffect(() => {
    const el = root.current
    if (!el || !enabled) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const target = { x: 0, y: 0 }
    let raf = 0

    const tick = () => {
      const v = value.current
      v.x += (target.x - v.x) * 0.08
      v.y += (target.y - v.y) * 0.08
      el.style.setProperty('--px', v.x.toFixed(4))
      el.style.setProperty('--py', v.y.toFixed(4))
      raf = Math.abs(target.x - v.x) + Math.abs(target.y - v.y) > 0.001 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1
      target.y = (e.clientY / window.innerHeight) * 2 - 1
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
      if (!raf) raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [root, enabled])

  return value
}
