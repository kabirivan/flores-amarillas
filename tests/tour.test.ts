import { describe, expect, it } from 'vitest'
import { ORBIT, tourCamera } from '@/lib/three/tour'
import type { CameraKey } from '@/lib/three/timeline'

const from: CameraKey = { x: 0, y: 0.2, z: 14, tx: 0, ty: -1.2, tz: 0 }
const to: CameraKey = { x: 0, y: 0, z: 13.5, tx: 0, ty: -1.4, tz: 0 }
const focus = { x: -0.8, y: 1.6, z: 0.9 }
const center = { x: 0, y: 0.2, z: 0 }
const at = (t: number) => tourCamera(t, from, to, focus, center)

describe('recorrido de cámara', () => {
  it('empieza en la cámara anterior y termina en la del final', () => {
    expect(at(0)).toEqual(from)
    const end = at(1)
    for (const k of Object.keys(to) as (keyof CameraKey)[]) expect(end[k]).toBeCloseTo(to[k], 6)
  })

  it('mira el ramo desde lo alto', () => {
    const c = at(0.22)
    // Muy por encima del centro, mirando hacia abajo.
    expect(c.y - center.y).toBeGreaterThan(5)
    expect(c.ty).toBeLessThan(c.y - 5)
  })

  it('baja desde arriba hasta la flor', () => {
    const c = at(0.36)
    expect(c.y).toBeGreaterThan(focus.y + 2)
    const d = Math.hypot(c.x - focus.x, c.y - focus.y, c.z - focus.z)
    expect(d).toBeLessThan(ORBIT.radius * 0.8) // más cerca que la vuelta alrededor
    expect(c.tx).toBeCloseTo(focus.x)
  })

  it('da una vuelta completa alrededor del centro', () => {
    let angle = 0
    let prev = Math.atan2(at(0.46).x - center.x, at(0.46).z - center.z)
    for (let t = 0.47; t <= 0.86; t += 0.01) {
      const c = at(t)
      expect(Math.hypot(c.x - center.x, c.z - center.z)).toBeCloseTo(ORBIT.radius, 3)
      const a = Math.atan2(c.x - center.x, c.z - center.z)
      let d = a - prev
      if (d < -Math.PI) d += Math.PI * 2
      if (d > Math.PI) d -= Math.PI * 2
      angle += d
      prev = a
    }
    expect(angle).toBeGreaterThan(Math.PI * 2 * 0.97)
  })

  it('es continuo: sin saltos entre tramos', () => {
    let last = at(0)
    for (let t = 0.002; t <= 1; t += 0.002) {
      const c = at(t)
      expect(Math.hypot(c.x - last.x, c.y - last.y, c.z - last.z)).toBeLessThan(0.35)
      last = c
    }
  })
})
