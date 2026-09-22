/**
 * Flores escaneadas o modeladas a mano (Sketchfab, CC-BY: créditos en CREDITS). Se cargan
 * una vez, antes de construir el ramo, y cada flor del ramo usa un clon que comparte la
 * geometría y la textura. Si una carga falla, el ramo usa la flor procedural de esa especie.
 *
 * Cada modelo se normaliza al cargarlo: centrado, la cara de la flor mirando a +Z (como las
 * cabezas procedurales) y radio 1, para colocarlo igual que una cabeza de `build.ts`.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type FlowerModel = {
  /** Geometría normalizada (radio 1, cara hacia +Z). */
  geometry: THREE.BufferGeometry
  map: THREE.Texture | null
}

export type BouquetModels = {
  sunflower?: FlowerModel
  gerbera?: FlowerModel
  rose?: FlowerModel
  /** Atlas fotográfico de la planta de girasol: hoja, cáliz y tallo (ver ATLAS en materials). */
  atlas?: THREE.Texture
}

type HeadKey = 'sunflower' | 'gerbera' | 'rose'

type Spec = {
  url: string
  /**
   * Hacia dónde mira la cara de la flor. Si es null, se calcula: el eje de menor grosor de la
   * cabeza (análisis de componentes principales), en el sentido de `hint`.
   */
  face: THREE.Vector3 | null
  hint?: THREE.Vector3
  /** Se queda solo con la parte de arriba (0–1 de la altura): quita el tallo del escaneo. */
  keepTop?: number
}

const SPECS: Partial<Record<HeadKey, Spec>> = {
  sunflower: { url: '/models/girasol.glb', face: null, hint: new THREE.Vector3(0, 0, 1) },
}

/**
 * Modelos disponibles pero sin cargar: el ramo es solo de girasoles. Para volver a usarlos,
 * añadirlos a SPECS (el ramo los usa si están: gerbera en lugar de margarita, rosa en lugar de
 * tulipán, fresia y mimosa).
 */
export const UNUSED_SPECS: Partial<Record<HeadKey, Spec>> = {
  gerbera: { url: '/models/gerbera.glb', face: null, hint: new THREE.Vector3(0, 1, 0), keepTop: 0.72 },
  rose: { url: '/models/rosa.glb', face: new THREE.Vector3(0, 1, 0) },
}

/** Eje de menor varianza de una nube de puntos (Jacobi sobre la covarianza 3×3). */
function thinnestAxis(pos: THREE.BufferAttribute, index: ArrayLike<number>): THREE.Vector3 {
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i < index.length; i++) c.add(v.fromBufferAttribute(pos, index[i]!))
  c.divideScalar(Math.max(1, index.length))
  const m = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (let i = 0; i < index.length; i++) {
    v.fromBufferAttribute(pos, index[i]!).sub(c)
    const a = [v.x, v.y, v.z]
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) m[r * 3 + k]! += a[r]! * a[k]!
  }
  const e = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  for (let sweep = 0; sweep < 30; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) {
      const apq = m[p * 3 + q]!
      if (Math.abs(apq) < 1e-12) continue
      const theta = (m[q * 3 + q]! - m[p * 3 + p]!) / (2 * apq)
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
      const cs = 1 / Math.sqrt(t * t + 1)
      const sn = t * cs
      for (let k = 0; k < 3; k++) {
        const mkp = m[k * 3 + p]!
        const mkq = m[k * 3 + q]!
        m[k * 3 + p] = cs * mkp - sn * mkq
        m[k * 3 + q] = sn * mkp + cs * mkq
      }
      for (let k = 0; k < 3; k++) {
        const mpk = m[p * 3 + k]!
        const mqk = m[q * 3 + k]!
        m[p * 3 + k] = cs * mpk - sn * mqk
        m[q * 3 + k] = sn * mpk + cs * mqk
      }
      for (let k = 0; k < 3; k++) {
        const ekp = e[k * 3 + p]!
        const ekq = e[k * 3 + q]!
        e[k * 3 + p] = cs * ekp - sn * ekq
        e[k * 3 + q] = sn * ekp + cs * ekq
      }
    }
  }
  const diag = [m[0]!, m[4]!, m[8]!]
  const j = diag.indexOf(Math.min(...diag))
  return new THREE.Vector3(e[j]!, e[3 + j]!, e[6 + j]!).normalize()
}

async function loadOne(loader: GLTFLoader, spec: Spec): Promise<FlowerModel> {
  const gltf = await loader.loadAsync(spec.url)
  gltf.scene.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o)
  })
  const mesh = meshes[0]
  if (!mesh) throw new Error(`sin malla: ${spec.url}`)
  // Hornea la transformación del archivo y normaliza: centro, orientación y tamaño.
  // Los atributos vienen cuantizados (enteros de 16 bits normalizados, por meshopt): se
  // pasan a float antes de hornear la transformación, o los valores se saturan.
  const parts = meshes.map((m) => {
    const g = new THREE.BufferGeometry()
    const src = m.geometry as THREE.BufferGeometry
    for (const name of ['position', 'normal', 'uv']) {
      const a = src.getAttribute(name) as THREE.BufferAttribute | undefined
      if (!a) continue
      const out = new Float32Array(a.count * a.itemSize)
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c)
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
    }
    g.setIndex(src.index ? src.index.clone() : [...Array(src.getAttribute('position').count).keys()])
    return g.applyMatrix4(m.matrixWorld)
  })
  const geometry = (parts.length > 1 ? mergeGeometries(parts) : parts[0]) ?? parts[0]!
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  // Sin tallo: solo los triángulos de la parte de arriba.
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!
  if (spec.keepTop !== undefined) {
    const cut = box.max.y - (box.max.y - box.min.y) * (1 - spec.keepTop)
    const idx = geometry.getIndex()!
    const kept: number[] = []
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i)
      const b = idx.getX(i + 1)
      const c = idx.getX(i + 2)
      if (pos.getY(a) > cut && pos.getY(b) > cut && pos.getY(c) > cut) kept.push(a, b, c)
    }
    geometry.setIndex(kept)
    geometry.computeBoundingBox()
  }
  const used = geometry.getIndex()!.array
  const face = spec.face ?? thinnestAxis(pos, used)
  if (spec.hint && face.dot(spec.hint) < 0) face.negate()
  const center = geometry.boundingBox!.getCenter(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(face.normalize(), new THREE.Vector3(0, 0, 1)))
  geometry.computeBoundingSphere()
  // Radio: el de la cabeza en el plano de la cara (lo que se ve de frente).
  let r = 0
  for (let i = 0; i < used.length; i++) r = Math.max(r, Math.hypot(pos.getX(used[i]!), pos.getY(used[i]!)))
  r = r || 1
  geometry.scale(1 / r, 1 / r, 1 / r)
  for (const g of parts) if (g !== geometry) g.dispose()
  const source = mesh.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
  const map = source.map ?? null
  if (map) map.colorSpace = THREE.SRGBColorSpace
  return { geometry, map }
}

let pending: Promise<BouquetModels> | null = null

/** Carga (una sola vez) los modelos disponibles. Nunca falla: omite los que no cargan. */
export function loadBouquetModels(): Promise<BouquetModels> {
  if (pending) return pending
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const atlas = loader
    .loadAsync('/models/girasol-planta.glb')
    .then((gltf) => {
      let map: THREE.Texture | null = null
      gltf.scene.traverse((o) => {
        if (!map && o instanceof THREE.Mesh) map = (o.material as THREE.MeshStandardMaterial).map
      })
      const tex = map as THREE.Texture | null
      if (tex) tex.colorSpace = THREE.SRGBColorSpace
      return ['atlas', tex ?? undefined] as const
    })
    .catch((err) => {
      console.warn('[flores] no se pudo cargar el atlas de hojas; se usan las procedurales', err)
      return ['atlas', undefined] as const
    })
  pending = Promise.all([
    atlas,
    ...(Object.keys(SPECS) as HeadKey[]).map(async (key) => {
      try {
        return [key, await loadOne(loader, SPECS[key]!)] as const
      } catch (err) {
        console.warn(`[flores] no se pudo cargar ${key}; se usa la flor procedural`, err)
        return [key, undefined] as const
      }
    }),
  ]).then((entries) => Object.fromEntries(entries.filter(([, v]) => v)) as BouquetModels)
  return pending
}
