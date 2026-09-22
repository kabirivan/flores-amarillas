/**
 * Girar el ramo: arrastrar en horizontal (ratón o dedo) y flechas del teclado, con inercia.
 * Solo el gesto horizontal: el vertical sigue siendo scroll (touch-action: pan-y en la
 * sección final). Cuando no está activo, el ramo vuelve suavemente de frente.
 */

import type * as THREE from 'three'

export type Spin = { setEnabled: (on: boolean) => void; update: (dt: number) => void; dispose: () => void }

const IGNORE = 'button, a, input, textarea, select, [role="button"]'

export function createSpin(target: THREE.Object3D): Spin {
  let enabled = false
  let dragging = false
  let lastX = 0
  let velocity = 0
  let angle = 0

  const onDown = (e: PointerEvent) => {
    if (!enabled || (e.target instanceof Element && e.target.closest(IGNORE))) return
    dragging = true
    lastX = e.clientX
    velocity = 0
  }
  const onMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    lastX = e.clientX
    const delta = (dx / Math.max(320, window.innerWidth)) * Math.PI * 1.6
    angle += delta
    velocity = delta * 60
  }
  const onUp = () => {
    dragging = false
  }
  const onKey = (e: KeyboardEvent) => {
    if (!enabled) return
    if (e.key === 'ArrowLeft') velocity -= 2.4
    else if (e.key === 'ArrowRight') velocity += 2.4
  }

  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('keydown', onKey)

  return {
    setEnabled(on) {
      enabled = on
      if (!on) dragging = false
    },
    update(dt) {
      if (!dragging) {
        angle += velocity * dt
        velocity *= Math.exp(-dt * 2.2)
        // Fuera del final (o en reposo largo) vuelve de frente, por el camino más corto.
        if (!enabled) {
          const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle))
          angle = wrapped * Math.exp(-dt * 3)
          velocity = 0
        }
      }
      target.rotation.y = angle
    },
    dispose() {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    },
  }
}
