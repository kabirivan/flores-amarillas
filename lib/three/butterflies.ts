/**
 * Mariposas para el final: unas vuelan alrededor del ramo (una se posa en la flor principal)
 * y otra bandada vuela a lo lejos, detrás del ramo, a distintas profundidades. Las alas se
 * pintan por código en un lienzo (degradado, nervaduras, borde oscuro y manchas), sin
 * imágenes, y brillan un poco por sí mismas: en la noche final tienen que verse.
 */

import * as THREE from 'three'
import { createRng } from '@/lib/bouquet/prng'

type Palette = { base: string; mid: string; edge: string; spots: string }

/** Tres especies que contrastan con el amarillo sin quitarle protagonismo. */
const PALETTES: readonly Palette[] = [
  { base: '#cfe0ff', mid: '#8fb0f5', edge: '#27305f', spots: '#ffffff' }, // azul lila
  { base: '#fffaf0', mid: '#efe6d6', edge: '#4a4d57', spots: '#2b2b33' }, // blanca de la col
  { base: '#ffc27a', mid: '#f08a3c', edge: '#2a1a12', spots: '#fff6e0' }, // anaranjada
]

/** Media ala (la derecha), con el cuerpo en el borde izquierdo del lienzo. */
function wingTexture(p: Palette): THREE.CanvasTexture {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = S
  const ctx = canvas.getContext('2d')!
  const body = { x: 6, y: S * 0.5 }

  const fore = new Path2D()
  fore.moveTo(body.x, body.y - 4)
  fore.bezierCurveTo(60, 10, 190, -6, 246, 30)
  fore.bezierCurveTo(250, 70, 215, 118, 150, 128)
  fore.bezierCurveTo(90, 136, 30, 130, body.x, body.y)
  const hind = new Path2D()
  hind.moveTo(body.x, body.y + 2)
  hind.bezierCurveTo(70, 132, 180, 150, 196, 196)
  hind.bezierCurveTo(206, 238, 150, 252, 100, 236)
  hind.bezierCurveTo(52, 220, 16, 180, body.x, body.y + 6)

  for (const wing of [hind, fore]) {
    const g = ctx.createRadialGradient(body.x, body.y, 8, body.x, body.y, 230)
    g.addColorStop(0, p.mid)
    g.addColorStop(0.45, p.base)
    g.addColorStop(0.8, p.mid)
    g.addColorStop(1, p.edge)
    ctx.fillStyle = g
    ctx.fill(wing)
    // Borde oscuro.
    ctx.save()
    ctx.clip(wing)
    ctx.lineWidth = 16
    ctx.strokeStyle = p.edge
    ctx.stroke(wing)
    // Nervaduras: líneas finas que salen del cuerpo.
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1.6
    for (let i = 0; i < 9; i++) {
      const a = -1.1 + i * 0.28
      ctx.beginPath()
      ctx.moveTo(body.x, body.y)
      ctx.quadraticCurveTo(body.x + 90 * Math.cos(a), body.y + 90 * Math.sin(a) - 10, body.x + 260 * Math.cos(a), body.y + 260 * Math.sin(a))
      ctx.stroke()
    }
    ctx.restore()
  }
  // Manchas claras cerca del borde y un ocelo en el ala trasera.
  ctx.fillStyle = p.spots
  for (const [x, y, r] of [
    [222, 38, 6],
    [206, 62, 5],
    [214, 90, 4],
    [176, 210, 5],
    [150, 228, 4],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = p.edge
  ctx.beginPath()
  ctx.arc(128, 186, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = p.base
  ctx.beginPath()
  ctx.arc(128, 186, 5, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

type Butterfly = {
  root: THREE.Group
  left: THREE.Mesh
  right: THREE.Mesh
  speed: number
  phase: number
  flap: number
  radius: number
  height: number
  resting: boolean
  /** A lo lejos: vuela por el fondo en vez de rodear el ramo. */
  far: boolean
}

export type Butterflies = {
  group: THREE.Group
  /**
   * `appear` (0–1): entran volando desde lejos. `center`/`radius`: el ramo. `rest`: dónde
   * se posa la mariposa que descansa (la flor principal, en coordenadas de mundo).
   */
  update: (t: number, appear: number, center: THREE.Vector3, radius: number, rest: THREE.Vector3) => void
  dispose: () => void
}

export function createButterflies(count: number, seed: string, farCount = 0): Butterflies {
  const rng = createRng(`mariposas:${seed}`)
  const group = new THREE.Group()
  group.name = 'mariposas'
  const textures = PALETTES.map(wingTexture)
  const materials = textures.map(
    (map) =>
      new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.45, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.65 }),
  )
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#1f1a1a', roughness: 0.8 })
  const wingGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)
  const bodyGeo = new THREE.CapsuleGeometry(0.035, 0.34, 4, 8)

  const flock: Butterfly[] = []
  for (let i = 0; i < count + farCount; i++) {
    const far = i >= count
    const root = new THREE.Group()
    const material = materials[i % materials.length]!
    const right = new THREE.Mesh(wingGeo, material)
    const left = new THREE.Mesh(wingGeo, material)
    left.scale.x = -1
    // El cuerpo apunta hacia +Z (lo que usa lookAt); las alas salen a los lados (±X) en
    // horizontal, con el ala delantera hacia delante. El aleteo gira sobre el eje del cuerpo.
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.rotation.x = Math.PI / 2
    const wings = new THREE.Group()
    wings.rotation.x = Math.PI / 2
    wings.add(right, left)
    root.add(wings, body)
    // Cerca, bien visibles; a lo lejos, más grandes para que la distancia no las borre.
    root.scale.setScalar(far ? rng.range(0.7, 1.05) : rng.range(0.34, 0.44))
    group.add(root)
    flock.push({ root, left, right, speed: rng.range(0.28, 0.45) * (rng.chance(0.5) ? 1 : -1), phase: rng.next() * Math.PI * 2, flap: rng.range(7, 10), radius: far ? rng.range(0, 1) : rng.range(0.78, 1.05), height: far ? rng.range(0, 1) : rng.range(-0.05, 0.5), resting: i === 0, far })
  }

  const pos = new THREE.Vector3()
  const ahead = new THREE.Vector3()
  const path = (b: Butterfly, t: number, center: THREE.Vector3, radius: number, out: THREE.Vector3, far: number) => {
    if (b.far) {
      // Por el fondo: cruzan de lado a lado (y vuelven), ondulando, a 8–20 unidades detrás.
      const s = t * Math.abs(b.speed) * 0.35 + b.phase
      const depth = 8 + b.radius * 12
      return out.set(
        center.x + Math.sin(s) * (10 + depth * 0.6),
        center.y + 0.5 + b.height * 4 + Math.sin(s * 2.3 + b.phase) * 0.8,
        center.z - depth + Math.cos(s * 1.7) * 2,
      )
    }
    const a = t * b.speed + b.phase
    const r = radius * b.radius * (1 + 0.18 * Math.sin(t * 0.7 + b.phase)) * far
    out.set(center.x + Math.sin(a) * r, center.y + radius * (b.height + 0.25 * Math.sin(t * 0.9 + b.phase * 2)), center.z + Math.cos(a) * r)
    return out
  }

  return {
    group,
    update(t, appear, center, radius, rest) {
      group.visible = appear > 0.001
      if (!group.visible) return
      // Entran desde lejos y se acercan al ramo.
      const far = 1 + (1 - appear) * 2.5
      for (const b of flock) {
        if (b.resting) {
          // Posada en la flor: se acerca volando y luego abre y cierra las alas despacio.
          path(b, t, center, radius, pos, far)
          const land = Math.min(1, Math.max(0, (appear - 0.4) / 0.6))
          b.root.position.copy(pos).lerp(rest, land * land * (3 - 2 * land))
          // Posada: cuerpo vertical y alas de cara a quien mira (así se ven abiertas).
          b.root.lookAt(b.root.position.x, b.root.position.y + 1, b.root.position.z + 0.25)
          const open = land >= 1 ? 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6)) : 0.9 * Math.abs(Math.sin(t * b.flap))
          b.right.rotation.y = open
          b.left.rotation.y = -open
          continue
        }
        path(b, t, center, radius, pos, far)
        path(b, t + 0.05, center, radius, ahead, far)
        // Aleteo con un pequeño rebote en cada batida.
        const beat = Math.sin(t * b.flap + b.phase)
        b.root.position.copy(pos)
        b.root.position.y += Math.abs(beat) * 0.04
        b.root.lookAt(ahead)
        b.right.rotation.y = 0.15 + 0.95 * Math.abs(beat)
        b.left.rotation.y = -(0.15 + 0.95 * Math.abs(beat))
      }
    },
    dispose() {
      for (const tx of textures) tx.dispose()
      for (const m of materials) m.dispose()
      bodyMat.dispose()
      wingGeo.dispose()
      bodyGeo.dispose()
    },
  }
}
