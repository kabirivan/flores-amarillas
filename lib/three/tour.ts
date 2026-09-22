/**
 * Recorrido de cámara del capítulo de contemplación, como quien tiene el ramo en las manos:
 *
 *   0.00–0.20  se acerca a la flor más vistosa, como para olerla (el ramo de luz se hace real)
 *   0.20–0.32  respira: un leve empuje adelante y atrás
 *   0.32–0.42  se aparta a media distancia, de frente
 *   0.42–0.82  da la vuelta completa al ramo (360°), subiendo como una grúa por detrás
 *   0.82–1.00  se aleja hasta el plano del ramo entero (el del final)
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
  // De cerca: un poco a la derecha y por encima de la flor, mirándola.
  const close: CameraKey = { x: focus.x + 0.5 * scale, y: focus.y + 0.4 * scale, z: focus.z + 5.2 * scale, tx: focus.x, ty: focus.y, tz: focus.z }
  const breath: CameraKey = { ...close, x: focus.x + 0.42 * scale, y: focus.y + 0.32 * scale, z: focus.z + 4.3 * scale }
  // La vuelta sube como una grúa: más alta por detrás, a su altura al cerrar el círculo.
  const orbit = (angle: number): CameraKey => ({
    x: center.x + Math.sin(angle) * ORBIT.radius * scale,
    y: center.y + ORBIT.height * scale * (1 + 0.8 * Math.sin(angle / 2) ** 2),
    z: center.z + Math.cos(angle) * ORBIT.radius * scale,
    tx: center.x,
    ty: center.y,
    tz: center.z,
  })

  if (t < 0.2) return mix(from, close, seg(t, 0, 0.2))
  if (t < 0.32) return mix(close, breath, Math.sin(clamp01((t - 0.2) / 0.12) * Math.PI))
  if (t < 0.42) return mix(close, orbit(0), seg(t, 0.32, 0.42))
  if (t < 0.82) return orbit(seg(t, 0.42, 0.82) * Math.PI * 2)
  return mix(orbit(Math.PI * 2), to, seg(t, 0.82, 1))
}
