/**
 * Jardín de fondo dibujado con hilos de neón (el mismo estilo que el ramo): hierba, girasoles
 * pequeños, espigas de lavanda y la silueta de unas colinas en el horizonte. Rodea el ramo
 * sin taparlo; lo lejano se apaga para dar profundidad.
 *
 * Todo en un solo LineSegments (una llamada de dibujo) con el shader de strands.ts: los hilos
 * ondulan con el viento y los recorre un pulso de luz.
 */

import * as THREE from 'three'
import { createRng } from '@/lib/bouquet/prng'
import { GROUND } from '../particles/shapes'
import { createStrands, sunflowerHead, type Strand, type Strands } from '../bouquet3d/strands'

export type GardenDensity = { grass: number; sunflowers: number; lavender: number }

/** Atenúa un color con la distancia (lo lejano, más tenue: niebla nocturna). */
const parsed = new Map<string, THREE.Color>()
const fade = (hex: string, d: number) => {
  let c = parsed.get(hex)
  if (!c) parsed.set(hex, (c = new THREE.Color(hex)))
  return c.clone().multiplyScalar(1 / (1 + d * 0.035))
}

export function createLineGarden(parent: THREE.Object3D, seed: string, density: GardenDensity): Strands {
  const rng = createRng(`jardin-hilos:${seed}`)
  const r = () => rng.next()
  const out: Strand[] = []

  /** Un sitio en el jardín alrededor del ramo, sin tapar la vista de la cámara (delante). */
  const spot = (minR: number, maxR: number): THREE.Vector3 | null => {
    const a = r() * Math.PI * 2
    const d = minR + (maxR - minR) * Math.sqrt(r())
    const p = new THREE.Vector3(Math.sin(a) * d, GROUND, Math.cos(a) * d)
    // Delante del ramo (entre él y la cámara) solo por los lados.
    if (p.z > 0.5 && Math.abs(p.x) < 2.6 + p.z * 0.35) return null
    return p
  }

  // Hierba: briznas curvas, verde oscuro a verde claro en la punta.
  for (let i = 0; i < density.grass; i++) {
    const p = spot(1.6, 26)
    if (!p) continue
    const d = p.length()
    const h = 0.25 + r() * 0.55 + d * 0.012
    const lean = new THREE.Vector3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.5 * h)
    const points: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    for (let k = 0; k <= 5; k++) {
      const t = k / 5
      points.push(p.clone().add(new THREE.Vector3(lean.x * t * t, h * t, lean.z * t * t)))
      colors.push(fade(t < 0.5 ? '#169a5a' : '#5dffb0', d))
    }
    out.push({ points, colors, wob: new THREE.Vector3(0.06 * h, 0, 0.03 * h), seed: r() })
  }

  // Girasoles pequeños con su tallo: miran hacia la cámara, con algo de variación.
  for (let i = 0; i < density.sunflowers; i++) {
    const p = spot(3, 22)
    if (!p) continue
    const d = p.length()
    const h = 0.9 + r() * 1.3
    const top = p.clone().add(new THREE.Vector3((r() - 0.5) * 0.3, h, 0))
    const stem: THREE.Vector3[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      stem.push(p.clone().lerp(top, t).add(new THREE.Vector3(Math.sin(t * Math.PI) * 0.08, 0, 0)))
    }
    for (let j = 0; j < 3; j++) {
      const off = new THREE.Vector3((j - 1) * 0.02, 0, 0)
      out.push({ points: stem.map((q) => q.clone().add(off)), colors: [fade('#3ddc84', d)], wob: new THREE.Vector3(0.05, 0, 0.02), seed: r() })
    }
    const facing = new THREE.Vector3((r() - 0.5) * 0.6, 0.25 + r() * 0.3, 1).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * Math.PI))
    const m = new THREE.Matrix4().compose(top, q, new THREE.Vector3(1, 1, 1))
    const head = sunflowerHead(0.26 + r() * 0.2, m, r, 14, 5, 10)
    const dim = 1 / (1 + d * 0.035)
    // Sin velo (de lejos no se aprecia y multiplica los vértices): solo los hilos.
    for (const s of head) {
      s.colors = s.colors.map((c) => c.clone().multiplyScalar(dim))
      delete s.sheet
    }
    out.push(...head)
  }

  // Lavanda: espigas lilas (contrastan con el amarillo sin quitarle protagonismo).
  for (let i = 0; i < density.lavender; i++) {
    const p = spot(2.5, 20)
    if (!p) continue
    const d = p.length()
    const h = 0.6 + r() * 0.7
    const bend = (r() - 0.5) * 0.3
    const points: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    for (let k = 0; k <= 10; k++) {
      const t = k / 10
      points.push(p.clone().add(new THREE.Vector3(bend * t * t, h * t, 0)))
      colors.push(fade(t < 0.55 ? '#1fae6a' : '#d47bff', d))
    }
    out.push({ points, colors, wob: new THREE.Vector3(0.05, 0, 0.02), seed: r() })
    // Florecillas: pequeños trazos a los lados de la parte alta de la espiga.
    for (let k = 0; k < 6; k++) {
      const t = 0.6 + k * 0.07
      const base = p.clone().add(new THREE.Vector3(bend * t * t, h * t, 0))
      const side = k % 2 ? 1 : -1
      out.push({
        points: [base, base.clone().add(new THREE.Vector3(side * 0.05, 0.05, 0))],
        colors: [fade('#f0a8ff', d)],
        wob: new THREE.Vector3(0.05, 0, 0.02),
        seed: r(),
      })
    }
  }

  // Colinas en el horizonte: varias líneas onduladas, tenues, detrás de todo.
  for (let ridge = 0; ridge < 5; ridge++) {
    const z = -28 - ridge * 6
    const amp = 1.2 + ridge * 0.6
    const ph = r() * 10
    const points: THREE.Vector3[] = []
    for (let k = 0; k <= 120; k++) {
      const x = -70 + (k / 120) * 140
      const y = GROUND + amp * (0.6 + 0.4 * Math.sin(x * 0.07 + ph) + 0.25 * Math.sin(x * 0.19 + ph * 2))
      points.push(new THREE.Vector3(x, y, z))
    }
    out.push({ points, colors: [new THREE.Color(ridge % 2 ? '#ff4fd8' : '#7b6bff').multiplyScalar(1 - ridge * 0.13)], wob: new THREE.Vector3(0, 0.02, 0), seed: r() })
  }

  return createStrands(out, parent, 0.8)
}
