'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'
import type { Box, Point } from '@/lib/bouquet/types'

export type Fit = {
  /** Píxeles por unidad del viewBox. */
  scale: number
  /** Convierte un punto del viewBox a píxeles dentro del contenedor. */
  toPx: (p: Point) => Point
  /** Tamaño del contenedor en píxeles. */
  width: number
  height: number
}

/**
 * Reproduce el cálculo de `preserveAspectRatio="xMidYMax meet"` para saber dónde cae en
 * pantalla un punto del ramo. Así el sobre se coloca exactamente sobre el punto de atado,
 * sea cual sea el tamaño de la ventana.
 */
export function useFitBox(ref: RefObject<HTMLElement | null>, view: Box): Fit | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  if (!size || size.w === 0 || size.h === 0) return null
  const scale = Math.min(size.w / view.width, size.h / view.height)
  const offsetX = (size.w - view.width * scale) / 2
  const offsetY = size.h - view.height * scale
  return {
    scale,
    width: size.w,
    height: size.h,
    toPx: (p) => ({ x: offsetX + (p.x - view.x) * scale, y: offsetY + (p.y - view.y) * scale }),
  }
}
