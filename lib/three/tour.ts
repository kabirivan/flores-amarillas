/**
 * Recorrido de cámara del capítulo de contemplación, como quien tiene el ramo en las manos:
 *
 *   0.00–0.22  sube hasta ver el ramo desde lo alto (unos 65° hacia abajo)
 *   0.22–0.36  baja despacio hacia la flor más vistosa, siempre desde arriba
 *   0.36–0.40  se queda un momento sobre ella, con un leve balanceo
 *   0.40–0.46  se aparta a media distancia, de frente
 *   0.46–0.86  da la vuelta completa al ramo (360°), subiendo como una grúa por detrás
 *   0.86–1.00  se aleja hasta el plano del ramo entero (el del final)
 *
 * Puro: recibe la flor de enfoque y el centro del ramo; empieza en la cámara del capítulo
 * anterior y termina en la del final, así no hay saltos al entrar ni al salir.
 */

import type { CameraKey } from './timeline'

export type Vec3 = { x: number; y: number; z: number }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mix = (a: CameraKey, b: CameraKey, t: number): CameraKey => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  tx: lerp(a.tx, b.tx, t),
  ty: lerp(a.ty, b.ty, t),
  tz: lerp(a.tz, b.tz, t),
})
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)))

export const ORBIT = { radius: 7.2, height: 1.1 }

/** `scale`: tamaño del ramo en el mundo (1 = ramo de 7 unidades de alto). */
export function tourCamera(t: number, from: CameraKey, to: CameraKey, focus: Vec3, center: Vec3, scale = 1): CameraKey {
  // Desde lo alto: sobre el ramo, algo por delante (mirar recto hacia abajo deja la cámara
  // sin orientación y las flores, que miran al frente, se verían de canto).
  const high: CameraKey = { x: center.x, y: center.y + 7.8 * scale, z: center.z + 3.6 * scale, tx: center.x, ty: center.y + 0.6 * scale, tz: center.z }
  // Cerca, desde arriba: encima de la flor y un poco por delante, mirándola.
  const close: CameraKey = { x: focus.x + 0.3 * scale, y: focus.y + 3.3 * scale, z: focus.z + 1.8 * scale, tx: focus.x, ty: focus.y, tz: focus.z }
  const sway: CameraKey = { ...close, x: focus.x + 0.55 * scale, y: focus.y + 3.0 * scale }
  // La vuelta sube como una grúa: más alta por detrás, a su altura al cerrar el círculo.
  const orbit = (angle: number): CameraKey => ({
    x: center.x + Math.sin(angle) * ORBIT.radius * scale,
    y: center.y + ORBIT.height * scale * (1 + 0.8 * Math.sin(angle / 2) ** 2),
    z: center.z + Math.cos(angle) * ORBIT.radius * scale,
    tx: center.x,
    ty: center.y,
    tz: center.z,
  })

  if (t < 0.22) return mix(from, high, seg(t, 0, 0.22))
  if (t < 0.36) return mix(high, close, seg(t, 0.22, 0.36))
  if (t < 0.4) return mix(close, sway, Math.sin(clamp01((t - 0.36) / 0.04) * Math.PI))
  if (t < 0.46) return mix(close, orbit(0), seg(t, 0.4, 0.46))
  if (t < 0.86) return orbit(seg(t, 0.46, 0.86) * Math.PI * 2)
  return mix(orbit(Math.PI * 2), to, seg(t, 0.86, 1))
}
