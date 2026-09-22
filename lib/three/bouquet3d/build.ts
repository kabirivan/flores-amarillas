/**
 * El ramo 3D, construido a partir del mismo Bouquet que genera el nombre.
 *
 * Mapeo al mundo: el encuadre del SVG (bouquet.view) ocupa 7 unidades de alto con la base
 * en GROUND y centrado en el eje del atado — el mismo que usan las partículas, para que
 * converjan exactamente sobre las flores. La profundidad (z) sale de la capa de pintado:
 * las flores de atrás del dibujo quedan detrás en 3D, así de frente se ve como el diseño
 * y al girarlo el ramo tiene volumen.
 *
 * Cada flor es un grupo con el pivote en el atado: el viento la mece entera.
 */

import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Bouquet, Flower } from '@/lib/bouquet/types'
import { createRng } from '@/lib/bouquet/prng'
import { GREENS, toneAt } from '@/lib/bouquet/palette'
import type { PetalShape } from '@/lib/bouquet/geometry'
import { GROUND } from '../particles/shapes'
import { col, leafGeometry, petalGeometry, photoLeafGeometry, type Bend } from './petals'
import { atlasUv, createAoUniform, createHeadMaterial, createMaterials, createRevealUniforms, tagMaterials, type Materials } from './materials'
import { createLightPoints, type LightPoints } from './points'
import { createStrands, leaf as strandLeaf, ribbon, sunflowerHead, wrapCone, type Strand } from './strands'
import type { BouquetModels, FlowerModel } from './models'
import { cyrb128 } from '@/lib/bouquet/prng'

const HEIGHT = 7

/** Escala del ramo dentro del jardín: apoyado en el suelo, a la altura de las flores. */
export const BOUQUET_SCALE = 0.52

export type Bouquet3D = {
  root: THREE.Group
  /** Número de flores del ramo. */
  count: number
  /** Cabeza de la flor más cercana a quien mira (para acercarse a olerla), en reposo. */
  focus: THREE.Vector3
  /** Cabeza de cada flor en el mundo, en reposo (a donde vuelan los cometas). */
  heads: THREE.Vector3[]
  /** Centro del ramo (para dar la vuelta alrededor). */
  center: THREE.Vector3
  /** Radio de la esfera que lo envuelve, en el mundo (el recorrido de cámara se adapta). */
  radius: number
  /** Revela el ramo entero (0 = invisible, 1 = completo). */
  setReveal: (v: number) => void
  /** Revela una flor (cuando aterriza su cometa de partículas). */
  setFlowerReveal: (k: number, v: number) => void
  /** Revela papel, seda, follaje y lazo. */
  setWrapReveal: (v: number) => void
  /** Orden de aparición de cada flor (0 = la primera). */
  orderOf: (k: number) => number
  /** Viento: t en segundos. */
  update: (t: number) => void
  /** Puntos de la superficie con su color, para que las partículas aterricen encima. */
  sample: (n: number, seed: string) => { pos: Float32Array; col: Float32Array }
  /**
   * Convierte el ramo en luz: muestrea `total` puntos de su superficie, los reparte por flor
   * y oculta el molde sólido. A partir de aquí el ramo se dibuja solo con partículas.
   */
  lightUp: (total: number, seed: string) => void
  /**
   * El ramo real: 0 = solo luz; 1 = ramo sólido con texturas (las partículas se apagan,
   * salvo algunos destellos). Aparece de abajo arriba con la materialización.
   */
  setReal: (v: number) => void
  /** Escala de pantalla para el tamaño de los puntos (px por unidad a distancia 1). */
  setView: (pixelRatio: number, viewScale: number) => void
  /** Lo mismo, solo de la flor k (tallo, hojas y cabeza). */
  sampleFlower: (k: number, n: number, seed: string) => { pos: Float32Array; col: Float32Array }
  dispose: () => void
}

export function buildBouquet3D(bouquet: Bouquet, models: BouquetModels = {}): Bouquet3D {
  const { view, bind } = bouquet
  const k = HEIGHT / view.height
  const W = HEIGHT * (view.width / view.height)
  const toWorld = (x: number, y: number) =>
    new THREE.Vector3(((x - view.x) / view.width - 0.5) * W, GROUND + (1 - (y - view.y) / view.height) * HEIGHT, 0)

  // Una disolución por flor y otra para el envoltorio: cada pieza aparece a su tiempo.
  const wrapReveal = createRevealUniforms()
  const ao = createAoUniform()
  const atlas = models.atlas ?? null
  const mat = tagMaterials(createMaterials(wrapReveal, ao, atlas))
  const flowerReveals = bouquet.flowers.map(() => createRevealUniforms())
  const flowerMats = flowerReveals.map((r) => tagMaterials(createMaterials(r, ao, atlas)))
  const rng = createRng(`ramo3d:${bouquet.seed}`)
  const root = new THREE.Group()
  root.name = 'ramo'
  const geometries: THREE.BufferGeometry[] = []
  const extraMaterials: THREE.Material[] = []
  const track = <G extends THREE.BufferGeometry>(g: G): G => {
    geometries.push(g)
    return g
  }

  const bindW = toWorld(bind.x, bind.y)
  const n = bouquet.flowers.length
  const sways: { group: THREE.Group; flower: Flower }[] = []
  const heads: THREE.Object3D[] = []

  const flowerGroups: THREE.Group[] = []
  /** Forma de cada flor para dibujarla en líneas (ver strands.ts), en el espacio de su grupo. */
  type StrandSpec = { curve: THREE.Curve<THREE.Vector3>; head: THREE.Vector3; facing: THREE.Vector3; spin: number; R: number; leaves: { at: THREE.Vector3; dir: THREE.Vector3; length: number }[] }
  const strandSpecs: StrandSpec[] = []
  // Cúpula: un ramo de florista reparte las cabezas sobre una semiesfera por encima del
  // papel, no en abanico. Espiral áurea (ninguna tapa a otra) con las más vistosas arriba.
  const mouth = toWorld(bind.x, bind.y - bouquet.wrap.shape.rise)
  /** Ramo con flores reales (modelos): cúpula compacta, cono fino, poco follaje. */
  const real = !!(models.sunflower || models.gerbera)
  // El centro de la cúpula queda por debajo del borde del papel: las cabezas del borde
  // arrancan justo encima de él y no se ven tallos desnudos.
  // Con flores reales (cabezas más llenas) la cúpula es más compacta: se tocan entre sí.
  // Ramo de girasoles de luz: cada cabeza con su espacio, para que se lea su disco oscuro.
  const domeR = models.sunflower ? 1.55 + n * 0.07 : real ? 1.12 + n * 0.048 : 1.8 + n * 0.075
  const domeC = new THREE.Vector3(0, mouth.y - domeR * (real ? 0.42 : 0.22), 0)
  const thetaMax = THREE.MathUtils.degToRad(70)
  const slots = new Map<number, THREE.Vector3>()
  bouquet.flowers
    .map((f, i) => ({ i, size: f.reach * f.scale * (f.species === 'sunflower' ? 1.3 : 1) }))
    .sort((a, b) => b.size - a.size)
    .forEach(({ i }, rank) => {
      const t = (rank + 0.5) / n
      const theta = Math.acos(1 - t * (1 - Math.cos(thetaMax)))
      const phi = rank * 2.39996 + rng.range(-0.15, 0.15)
      const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi))
      slots.set(i, domeC.clone().add(dir.multiplyScalar(domeR * rng.range(0.9, 1.07))))
    })

  bouquet.flowers.forEach((flower, fi) => {
    const mat = flowerMats[fi]!
    const head = slots.get(fi) ?? toWorld(flower.head.x, flower.head.y)

    const group = new THREE.Group()
    group.position.copy(bindW)
    root.add(group)
    flowerGroups.push(group)
    sways.push({ group, flower })
    const local = (v: THREE.Vector3) => v.clone().sub(bindW)

    // Tallo: curva desde el atado, arqueada hacia fuera.
    const h = local(head)
    // Con el cono fino, el tallo sube por dentro del papel (cerca del eje) y solo se abre hacia
    // su flor por encima de la boca; si no, lo atravesaría.
    const mouthY = mouth.y - bindW.y
    const mid1 = real
      ? new THREE.Vector3(h.x * 0.08, mouthY * 0.55, h.z * 0.08)
      : h.clone().multiplyScalar(0.33).add(new THREE.Vector3(h.x * 0.15, 0, h.z * 0.1))
    const mid2 = real
      ? new THREE.Vector3(h.x * 0.22, Math.max(mouthY * 1.05, h.y * 0.55), h.z * 0.22)
      : h.clone().multiplyScalar(0.7).add(new THREE.Vector3(h.x * 0.08, 0, h.z * 0.05))
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.6, 0), mid1, mid2, h])
    const radius = Math.max(0.03, flower.stem.width * k * 0.45)
    group.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 28, radius, 6, false)), mat.stem))

    // Hojas a lo largo del tallo, solo en la parte que asoma del papel. Se alternan en
    // espiral (ángulo áureo, como en las plantas reales) y son más pequeñas cuanto más arriba.
    const leafSpecs: StrandSpec['leaves'] = []
    const leafCount = rng.int(3, 5)
    const golden = THREE.MathUtils.degToRad(137.5)
    const az0 = rng.next() * Math.PI * 2
    const leafColor = flower.leaves[0]?.color ?? GREENS.mid
    for (let i = 0; i < leafCount; i++) {
      const u = 0.3 + (i / Math.max(1, leafCount - 1)) * 0.5 + rng.range(-0.04, 0.04)
      const at = curve.getPointAt(u)
      const size = 1 - (u - 0.3) * 0.6
      const len = rng.range(40, 54) * size
      const curl = rng.range(-0.5, 0.5)
      // Hoja fotografiada si hay atlas (más corta: es más ancha que la dibujada).
      const geo = track(
        mat.photoLeaf
          ? photoLeafGeometry(len * 0.58, curl * 0.3)
          : leafGeometry(len, rng.range(10, 13) * size, curl, [col(GREENS.deep), col(leafColor), col(GREENS.mid)]),
      )
      const leaf = new THREE.Mesh(geo, mat.photoLeaf ?? mat.leaf)
      leaf.scale.setScalar(k * 1.15)
      leaf.position.copy(at)
      // Sale del tallo hacia fuera y hacia arriba, y se gira un poco sobre su nervio.
      const az = az0 + i * golden
      const dir = new THREE.Vector3(Math.sin(az), rng.range(0.5, 0.9), Math.cos(az)).normalize()
      leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      leaf.rotateY(rng.range(-0.7, 0.7))
      group.add(leaf)
      leafSpecs.push({ at: at.clone(), dir: dir.clone(), length: len * 0.58 * k * 1.15 })
    }

    // Cabeza: orientada hacia quien mira y un poco hacia fuera y arriba.
    const headGroup = new THREE.Group()
    headGroup.position.copy(h)
    // Cada flor mira hacia fuera de la cúpula (y un poco hacia arriba).
    // Los girasoles se giran hacia quien mira (se leen de frente); el resto, hacia fuera.
    const facing = models.sunflower
      ? head.clone().sub(domeC).normalize().multiplyScalar(0.45).add(new THREE.Vector3(0, 0.35, 1)).normalize()
      : head.clone().sub(domeC).add(new THREE.Vector3(0, 0.6, 0)).normalize()
    // En 3D las cabezas se ven de frente y algo en escorzo: un poco más grandes que en el dibujo.
    const scale = flower.scale * k * 1.2
    group.add(headGroup)
    heads.push(headGroup)

    // Ramo de girasoles: con el escaneo cargado, todas las cabezas son girasoles (cada una a
    // su tamaño). Sin él, cada especie con su flor procedural.
    const reach = flower.layout.kind === 'rosette' ? Math.max(...flower.layout.petals.map((p) => p.radius + p.shape.length)) : 44
    strandSpecs.push({ curve, head: h.clone(), facing: facing.clone(), spin: flower.spin, R: reach * scale * 0.72, leaves: leafSpecs })
    if (models.sunflower) {
      const m = createHeadMaterial(models.sunflower.map, flowerReveals[fi]!, ao)
      extraMaterials.push(m)
      buildModelHead(headGroup, flower, models.sunflower, facing, scale, reach, m, mat, track)
    } else switch (flower.layout.kind) {
      case 'rosette': {
        // Flores reales cuando hay modelo: girasol escaneado y gerbera (en lugar de margarita).
        const model = flower.species === 'sunflower' ? models.sunflower : models.gerbera
        if (model) {
          // La gerbera escaneada es blanca: se tiñe con el amarillo de su flor.
          // Tonos suaves: gerberas en amarillo pastel; el girasol, apenas atenuado.
          const tint = flower.species === 'sunflower' ? '#fff3dc' : toneAt(flower.tone.index).base
          const m = createHeadMaterial(model.map, flowerReveals[fi]!, ao, tint)
          extraMaterials.push(m)
          buildModelHead(headGroup, flower, model, facing, scale, 40, m, mat, track)
        } else buildRosette(headGroup, flower, facing, scale, mat, track, rng)
        break
      }
      case 'cup':
        // Rosa amarilla escaneada en lugar del tulipán.
        if (models.rose) {
          const m = createHeadMaterial(models.rose.map, flowerReveals[fi]!, ao)
          extraMaterials.push(m)
          buildModelCup(headGroup, flower, models.rose, h, scale, m)
        } else buildTulip(headGroup, flower, h, scale, mat, track)
        break
      case 'spike':
        // Rosa pequeña (de ramillete) en lugar de la fresia, si hay modelo.
        if (models.rose) {
          const m = createHeadMaterial(models.rose.map, flowerReveals[fi]!, ao)
          extraMaterials.push(m)
          const mesh = new THREE.Mesh(models.rose.geometry, m)
          mesh.quaternion.setFromUnitVectors(Z, facing.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize())
          mesh.scale.setScalar(21 * scale)
          headGroup.add(mesh)
        } else buildFreesia(headGroup, flower, facing, scale, mat, track, rng)
        break
      case 'pompons':
        // Con modelos reales, la mimosa procedural se nota: en su lugar, un ramillete de tres
        // rosas pequeñas (rosa de pitiminí), cada una mirando un poco hacia fuera.
        if (models.rose) {
          const m = createHeadMaterial(models.rose.map, flowerReveals[fi]!, ao, toneAt(flower.tone.index).light)
          extraMaterials.push(m)
          const side = new THREE.Vector3().crossVectors(facing, Y).normalize()
          for (let b = 0; b < 3; b++) {
            const a = (b / 3) * Math.PI * 2 + flower.spin * 0.02
            const off = side.clone().multiplyScalar(Math.cos(a)).add(new THREE.Vector3(0, Math.sin(a), 0)).multiplyScalar(9 * scale)
            const mesh = new THREE.Mesh(models.rose.geometry, m)
            mesh.quaternion.setFromUnitVectors(Z, facing.clone().add(off.clone().normalize().multiplyScalar(0.5)).add(new THREE.Vector3(0, 0.4, 0)).normalize())
            mesh.rotateZ(a * 2)
            mesh.position.copy(off)
            mesh.scale.setScalar((b === 0 ? 14 : 11.5) * scale)
            headGroup.add(mesh)
          }
        } else buildMimosa(headGroup, flower, facing, scale, mat, track)
        break
    }
  })

  const wrapShape = buildWrap(root, bouquet, toWorld, k, mat, track, real ? 0.8 : 1)
  buildGreenery(root, bouquet, toWorld, k, mat, track, rng, real ? 0.8 : 1)
  if (real && !models.sunflower) buildBed(root, domeC, domeR, thetaMax, n, k, models, wrapReveal, ao, extraMaterials, rng)
  buildFiller(root, bindW, domeC, domeR, n, k, mat, track, rng, real)

  // A escala del jardín: la punta del cono sigue apoyada en el suelo.
  root.scale.setScalar(BOUQUET_SCALE)
  root.position.y = GROUND * (1 - BOUQUET_SCALE)
  root.updateMatrixWorld(true)
  // Enfoque: la flor más vistosa (cabeza más grande), con preferencia por las de delante.
  // No la más adelantada a secas: en un ramo esas son las más bajas, pegadas al papel.
  const worldHeads = heads.map((h) => h.getWorldPosition(new THREE.Vector3()))
  const score = (i: number) => {
    const f = bouquet.flowers[i]
    const p = worldHeads[i]
    return f && p ? f.reach * f.scale * (f.species === 'sunflower' ? 1.3 : 1) + p.z * 20 : -Infinity
  }
  let focusIndex = 0
  for (let i = 1; i < worldHeads.length; i++) if (score(i) > score(focusIndex)) focusIndex = i
  const focus = worldHeads[focusIndex] ?? new THREE.Vector3()
  // Oclusión: la cúpula de flores en el mundo (el interior del ramo queda en sombra).
  const domeWorld = root.localToWorld(domeC.clone())
  ao.value.set(domeWorld.x, domeWorld.y, domeWorld.z, domeR * BOUQUET_SCALE)
  const box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius

  const all = [wrapReveal, ...flowerReveals]
  // Nubes de luz (cuando se llama a lightUp): una por flor y otra para el envoltorio.
  let lightFlowers: LightPoints[][] = []
  let lightWrap: LightPoints | null = null
  const meshes: THREE.Mesh[] = []
  const lights = () => [...lightFlowers.flat(), lightWrap].filter((l): l is LightPoints => l !== null)
  const setLight = (l: LightPoints | null | undefined, v: number) => {
    const u = l?.material.uniforms.uReveal
    if (u) u.value = v
  }
  return {
    root,
    count: bouquet.flowers.length,
    heads: worldHeads,
    focus,
    center,
    radius,
    setReveal(v) {
      for (const l of lights()) setLight(l, v)
      root.visible = v > 0.001
    },
    setFlowerReveal(k, v) {
      for (const l of lightFlowers[k] ?? []) setLight(l, v)
      const g = flowerGroups[k]
      if (g) g.visible = v > 0.001
      root.visible = true
    },
    setWrapReveal(v) {
      setLight(lightWrap, v)
      root.visible = true
    },
    setReal(v) {
      for (const r of all) r.uReveal.value = v
      for (const m of meshes) m.visible = v > 0.001
      // La luz se apaga a medida que el ramo se hace real; quedan algunos destellos.
      for (const l of lights()) {
        const u = l.material.uniforms.uAlpha
        if (u) u.value = (l.material.userData.alpha as number) * (1 - v * 0.88)
      }
    },
    lightUp(total, seed) {
      // Un solo muestreo de todo el ramo y cada punto a la pieza de la que sale.
      const ownerOf = new Map<THREE.Object3D, number>()
      flowerGroups.forEach((g, k) => g.traverse((o) => ownerOf.set(o, k)))
      const samples = sampleSurface(root, total, `luz:${seed}`, undefined, (m) => ownerOf.get(m) ?? -1)
      const byOwner = new Map<number, number[]>()
      samples.owner.forEach((o, i) => {
        const list = byOwner.get(o) ?? []
        list.push(i)
        byOwner.set(o, list)
      })
      const pick = (idx: number[]): Samples => {
        const pos = new Float32Array(idx.length * 4)
        const col = new Float32Array(idx.length * 4)
        const nor = new Float32Array(idx.length * 3)
        idx.forEach((j, i) => {
          pos.set(samples.pos.subarray(j * 4, j * 4 + 4), i * 4)
          col.set(samples.col.subarray(j * 4, j * 4 + 4), i * 4)
          nor.set(samples.nor.subarray(j * 3, j * 3 + 3), i * 3)
        })
        return { pos, col, nor }
      }
      const [h] = cyrb128(`luz:${seed}`)
      // Tamaño de cada punto (unidades del mundo): del orden del espacio entre puntos.
      const size = 0.028 * BOUQUET_SCALE * Math.sqrt(40000 / Math.max(1000, total)) * 1.6
      // Más puntos, menos luz cada uno: la suma (aditiva) no se quema a blanco y el color de
      // los girasoles se lee.
      const dim = Math.min(1, 42000 / Math.max(1000, total))
      // Ramo de girasoles en líneas que fluyen (con el escaneo cargado): cada flor, sus hilos.
      if (models.sunflower) {
        const rand = createRng(`hilos:${seed}`)
        const r = () => rand.next()
        lightFlowers = flowerGroups.map((g, k) => {
          const spec = strandSpecs[k]
          if (!spec) return []
          const q = new THREE.Quaternion().setFromUnitVectors(Z, spec.facing).multiply(new THREE.Quaternion().setFromAxisAngle(Z, THREE.MathUtils.degToRad(spec.spin)))
          const m = new THREE.Matrix4().compose(spec.head, q, new THREE.Vector3(1, 1, 1))
          const all: Strand[] = [
            ...ribbon(spec.curve, { strands: 26, samples: 48, width: 0.34, twist: Math.PI * 3, from: '#1f5a2c', to: '#a6d95f', wob: 0.05, rand: r }),
            ...spec.leaves.flatMap((l) => strandLeaf(l.at, l.dir, l.length, r)),
            ...sunflowerHead(spec.R, m, r),
          ]
          return [createStrands(all, g, 0.5) as unknown as LightPoints]
        })
        lightWrap = createStrands(wrapCone(wrapShape.tip, wrapShape.height, wrapShape.R, r), root, 0.22) as unknown as LightPoints
      } else {
      lightFlowers = flowerGroups.map((g, k) => {
        const idx = byOwner.get(k) ?? []
        return idx.length ? [createLightPoints(pick(idx), idx.length, g, 0.95, size * 0.72, h + k, true)] : []
      })
      // La flor que se huele en el recorrido lleva densidad extra: de cerca tiene que leerse.
      const focusGroup = flowerGroups[focusIndex]
      if (focusGroup) {
        const extra = Math.round(total * 0.25)
        const more = sampleSurface(focusGroup, extra, `luz:foco:${seed}`)
        lightFlowers[focusIndex]?.push(createLightPoints(more, extra, focusGroup, 0.95, size * 0.6, h + 77, true))
      }
      const wrapIdx = byOwner.get(-1) ?? []
      lightWrap = wrapIdx.length ? createLightPoints(pick(wrapIdx), wrapIdx.length, root, 0.16 * dim, size * 1.05, h + 99) : null
      }
      // El molde sólido no se dibuja hasta que el ramo se hace real (setReal).
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          meshes.push(o)
          o.visible = false
        }
      })
    },
    setView(pixelRatio, viewScale) {
      for (const l of lights()) {
        const u = l.material.uniforms
        if (u.uPixelRatio) u.uPixelRatio.value = pixelRatio
        if (u.uViewScale) u.uViewScale.value = viewScale
      }
    },
    orderOf(k) {
      return bouquet.flowers[k]?.order ?? k
    },
    update(t) {
      for (const l of lights()) {
        const u = l.material.uniforms.uTime
        if (u) u.value = t
      }
      for (const { group, flower } of sways) {
        const w = (t / flower.sway.duration) * Math.PI * 2 + flower.sway.phase * Math.PI * 2
        const a = THREE.MathUtils.degToRad(flower.sway.amplitude) * 1.4
        group.rotation.z = Math.sin(w) * a
        group.rotation.x = Math.cos(w * 0.8) * a * 0.5
      }
    },
    sample(count, seed) {
      return sampleSurface(root, count, seed)
    },
    sampleFlower(k, count, seed) {
      const g = flowerGroups[k]
      return g ? sampleSurface(g, count, `${seed}:${k}`) : { pos: new Float32Array(count * 4), col: new Float32Array(count * 4) }
    },
    dispose() {
      for (const g of geometries) g.dispose()
      mat.dispose()
      for (const m of flowerMats) m.dispose()
      for (const m of extraMaterials) m.dispose()
      for (const l of lights()) {
        l.points.geometry.dispose()
        ;(l.points.userData.veil as THREE.BufferGeometry | undefined)?.dispose()
        l.material.dispose()
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Especies
// ---------------------------------------------------------------------------

type Track = <G extends THREE.BufferGeometry>(g: G) => G
type Rng = ReturnType<typeof createRng>

const Z = new THREE.Vector3(0, 0, 1)
const Y = new THREE.Vector3(0, 1, 0)

/** Coloca un pétalo: gira `angle` alrededor del eje de la flor e inclina `tilt` desde el plano. */
function petalMatrix(angleDeg: number, radius: number, tiltDeg: number, s: number): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
    .setFromAxisAngle(Z, THREE.MathUtils.degToRad(-angleDeg))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(tiltDeg)))
  const offset = new THREE.Vector3(0, radius, 0).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(Z, THREE.MathUtils.degToRad(-angleDeg)))
  m.compose(offset.multiplyScalar(s), q, new THREE.Vector3(s, s, s))
  return m
}

/** Un InstancedMesh con una geometría de pétalo por anillo. */
function ring(
  parent: THREE.Object3D,
  petals: { angle: number; radius: number; shape: PetalShape; shift: number }[],
  bend: Bend,
  tone: number,
  tilt: (i: number) => number,
  s: number,
  mat: Materials,
  track: Track,
) {
  if (petals.length === 0) return
  // Una geometría por anillo (la forma media); la variación va en la matriz y el color.
  const avg = petals[Math.floor(petals.length / 2)]!.shape
  const t = toneAt(tone)
  const geo = track(petalGeometry(avg, bend, [col(t.shade), col(t.base), col(t.base).lerp(col(t.light), 0.35)]))
  const mesh = new THREE.InstancedMesh(geo, mat.petal, petals.length)
  const c = new THREE.Color()
  petals.forEach((p, i) => {
    const lenScale = p.shape.length / avg.length
    const m = petalMatrix(p.angle, p.radius, tilt(i), s)
    m.multiply(new THREE.Matrix4().makeScale(p.shape.width / avg.width, lenScale, 1))
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, c.setScalar(1 + p.shift * 0.06))
  })
  parent.add(mesh)
}

function buildRosette(g: THREE.Group, f: Flower, facing: THREE.Vector3, s: number, mat: Materials, track: Track, rng: Rng) {
  if (f.layout.kind !== 'rosette') return
  const face = new THREE.Group()
  face.quaternion.setFromUnitVectors(Z, facing)
  face.rotateZ(THREE.MathUtils.degToRad(f.spin))
  g.add(face)
  const sunflower = f.species === 'sunflower'
  const { petals, core } = f.layout

  // Sépalos verdes detrás.
  const sepal: PetalShape = { length: core.radius * 0.7 + 8, width: (core.radius * 0.7 + 8) * 0.32, waist: 0.35, base: 0.6, tip: 0.05, notch: 0 }
  const sepGeo = track(petalGeometry(sepal, { cup: 0.1, curl: -0.1 }, [col(GREENS.deep), col(GREENS.mid), col(GREENS.light)]))
  const count = sunflower ? 14 : 10
  const sepals = new THREE.InstancedMesh(sepGeo, mat.leaf, count)
  for (let i = 0; i < count; i++) sepals.setMatrixAt(i, petalMatrix((360 / count) * i + 180 / count, core.radius * 0.7, -10, s))
  sepals.position.z = -0.06 * s * 10
  face.add(sepals)

  // Pétalos: coronas exterior e interior (el girasol tiene dos).
  const outerR = Math.max(...petals.map((p) => p.radius))
  const outer = petals.filter((p) => p.radius >= outerR - 0.01)
  const inner = petals.filter((p) => p.radius < outerR - 0.01)
  const bend: Bend = sunflower ? { cup: 0.1, curl: -0.12 } : { cup: 0.06, curl: 0.06 }
  // Inclinación hacia delante desde el plano de la flor: poca, para que los pétalos se
  // abran en abanico y no apunten a la cámara.
  ring(face, outer, bend, f.tone.index, () => (sunflower ? 14 : 8) + rng.range(-5, 5), s, mat, track)
  ring(face, inner, { cup: 0.14, curl: 0.05 }, f.tone.index + 0.6, () => 26 + rng.range(-6, 6), s, mat, track)

  // Centro: capítulo abombado con semillas en espiral de Fermat (girasol) o botón (margarita).
  const discGeo = track(new THREE.SphereGeometry(core.radius * s, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2))
  const disc = new THREE.Mesh(discGeo, sunflower ? mat.disc : mat.daisyCore)
  disc.rotation.x = Math.PI / 2
  disc.scale.set(1, sunflower ? 0.32 : 0.55, 1)
  face.add(disc)
  // Receptáculo: la parte de atrás de la flor, verde y cerrada (al girar el ramo, el
  // capítulo no se ve hueco).
  const backGeo = track(new THREE.SphereGeometry(core.radius * s * 1.08, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2))
  const back = new THREE.Mesh(backGeo, mat.stem)
  back.rotation.x = Math.PI / 2
  back.scale.set(1, 0.5, 1)
  face.add(back)
  if (sunflower) {
    const dot = track(new THREE.IcosahedronGeometry(1, 2))
    const dots = new THREE.InstancedMesh(dot, mat.seedDot, core.dots.length)
    const m = new THREE.Matrix4()
    core.dots.forEach((d, i) => {
      const rr = Math.hypot(d.x, d.y) / core.radius
      const zz = Math.sqrt(Math.max(0, 1 - rr * rr)) * core.radius * 0.32
      m.compose(new THREE.Vector3(d.x * s, -d.y * s, zz * s), new THREE.Quaternion(), new THREE.Vector3(d.r * s * 1.15, d.r * s * 1.15, d.r * s * 0.6))
      dots.setMatrixAt(i, m)
    })
    face.add(dots)
  }
}

/**
 * Cabeza de girasol real (el escaneo), del tamaño de la cabeza del dibujo: `reach` = centro +
 * pétalo más largo, en unidades del SVG. Detrás, el receptáculo verde para que al girar el
 * ramo no se vea hueca.
 */
function buildModelHead(g: THREE.Group, f: Flower, model: FlowerModel, facing: THREE.Vector3, s: number, reach: number, head: THREE.Material, mat: Materials, track: Track) {
  const face = new THREE.Group()
  face.quaternion.setFromUnitVectors(Z, facing)
  face.rotateZ(THREE.MathUtils.degToRad(f.spin))
  g.add(face)
  const mesh = new THREE.Mesh(model.geometry, head)
  // El girasol real llena más que el dibujo (pétalos densos): algo más pequeño.
  mesh.scale.setScalar(reach * s * 0.66)
  face.add(mesh)
  const r = reach * 0.34 * s
  const back = new THREE.Mesh(track(new THREE.SphereGeometry(r * 1.1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), mat.stem)
  back.rotation.x = Math.PI / 2
  back.scale.set(1, 0.5, 1)
  back.position.z = -r * 0.25
  face.add(back)
}

/** Rosa: mira hacia arriba siguiendo el tallo, del tamaño de la copa del tulipán. */
function buildModelCup(g: THREE.Group, f: Flower, model: FlowerModel, stemTip: THREE.Vector3, s: number, head: THREE.Material) {
  if (f.layout.kind !== 'cup') return
  const size = Math.max(...[...f.layout.back, ...f.layout.front].map((p) => p.shape.length)) * 1.08
  const mesh = new THREE.Mesh(model.geometry, head)
  mesh.quaternion.setFromUnitVectors(Z, new THREE.Vector3(stemTip.x * 0.12, 1, 0.35).normalize())
  mesh.rotateZ(THREE.MathUtils.degToRad(f.spin))
  mesh.scale.setScalar(size * s)
  mesh.position.y = size * s * 0.35
  g.add(mesh)
}

function buildTulip(g: THREE.Group, f: Flower, stemTip: THREE.Vector3, s: number, mat: Materials, track: Track) {
  if (f.layout.kind !== 'cup') return
  // El tulipán mira hacia arriba, siguiendo el tallo.
  const cup = new THREE.Group()
  cup.quaternion.setFromUnitVectors(Y, new THREE.Vector3(stemTip.x * 0.12, 1, 0.25).normalize())
  g.add(cup)
  const t = toneAt(f.tone.index)
  const all = [...f.layout.back.map((p) => ({ ...p, back: true })), ...f.layout.front.map((p) => ({ ...p, back: false }))]
  const geo = track(petalGeometry(all[0]!.shape, { cup: 0.42, curl: 0.12 }, [col(t.shade), col(t.base), col(t.base).lerp(col(t.light), 0.35)]))
  const mesh = new THREE.InstancedMesh(geo, mat.petal, all.length)
  const m = new THREE.Matrix4()
  all.forEach((p, i) => {
    // Seis pétalos en copa: tres fuera y tres dentro, alternados.
    const az = (i / all.length) * Math.PI * 2 + (p.back ? 0 : Math.PI / all.length)
    const q = new THREE.Quaternion()
      .setFromAxisAngle(Y, az)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(p.back ? -22 : -12)))
    const pos = new THREE.Vector3(Math.sin(az), 0, Math.cos(az)).multiplyScalar((p.back ? 3 : 1.5) * s)
    const scl = (p.back ? 1 : 0.94) * s
    m.compose(pos, q, new THREE.Vector3(scl * (p.shape.width / all[0]!.shape.width), scl * (p.shape.length / all[0]!.shape.length), scl))
    mesh.setMatrixAt(i, m)
  })
  cup.add(mesh)
}

function buildFreesia(g: THREE.Group, f: Flower, facing: THREE.Vector3, s: number, mat: Materials, track: Track, rng: Rng) {
  if (f.layout.kind !== 'spike') return
  const plane = new THREE.Group()
  plane.quaternion.setFromUnitVectors(Z, facing)
  g.add(plane)
  const bells = f.layout.bells
  const pts = [new THREE.Vector3(0, -10 * s, 0), ...bells.map((b) => new THREE.Vector3(b.x * s, -b.y * s, 0))]
  plane.add(new THREE.Mesh(track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 5, false)), mat.stem))
  const t = toneAt(f.tone.index)
  const bellShape: PetalShape = { length: 22, width: 7.5, waist: 0.66, base: 0.35, tip: 0.9, notch: 0 }
  const geo = track(petalGeometry(bellShape, { cup: 0.38, curl: -0.18 }, [col(t.shade), col(t.base), col(t.base).lerp(col(t.light), 0.4)]))
  const total = bells.length * 5
  const mesh = new THREE.InstancedMesh(geo, mat.petal, total)
  const m = new THREE.Matrix4()
  let i = 0
  for (const b of bells) {
    // Trompeta: cinco pétalos abiertos alrededor del eje de la campana.
    const axis = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(b.angle)), Math.cos(THREE.MathUtils.degToRad(b.angle)), 0.3).normalize()
    const base = new THREE.Quaternion().setFromUnitVectors(Y, axis)
    for (let p = 0; p < 5; p++) {
      const q = base
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(Y, (p / 5) * Math.PI * 2 + rng.range(-0.1, 0.1)))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.42))
      const sc = s * b.scale * 0.9
      m.compose(new THREE.Vector3(b.x * s, -b.y * s, 0), q, new THREE.Vector3(sc, sc, sc))
      mesh.setMatrixAt(i++, m)
    }
  }
  plane.add(mesh)
}

function buildMimosa(g: THREE.Group, f: Flower, facing: THREE.Vector3, s: number, mat: Materials, track: Track) {
  if (f.layout.kind !== 'pompons') return
  const plane = new THREE.Group()
  plane.quaternion.setFromUnitVectors(Z, facing)
  g.add(plane)
  for (const twig of f.layout.twigs) {
    // Las ramitas son curvas cuadráticas "M0,6 Q cx,cy tx,ty": se reconstruyen en 3D.
    const nums = twig.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
    const [, y0 = 6, cx = 0, cy = 0, tx = 0, ty = 0] = nums
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -y0 * s, 0), new THREE.Vector3(cx * s, -cy * s, 0.05), new THREE.Vector3(tx * s, -ty * s, 0))
    plane.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 10, 0.018, 4, false)), mat.stem))
  }
  // Borlas pequeñas y vellosas, en racimos: cada borla del dibujo se reparte en varias más
  // chicas (la mimosa real son decenas de bolitas de pocos milímetros).
  const ball = track(fuzzyBall(1))
  const per = 3
  const mesh = new THREE.InstancedMesh(ball, mat.pompon, f.layout.florets.length * per)
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  const q = new THREE.Quaternion()
  let i = 0
  f.layout.florets.forEach((fl, j) => {
    for (let b = 0; b < per; b++) {
      const a = (b / per) * Math.PI * 2 + j
      const off = b === 0 ? 0 : fl.r * 0.9
      const r = fl.r * (b === 0 ? 0.62 : 0.48)
      q.setFromEuler(new THREE.Euler(j, b * 2.1, j * 0.7))
      m.compose(new THREE.Vector3((fl.x + Math.cos(a) * off) * s, (-fl.y + Math.sin(a) * off) * s, ((j + b) % 3) * 0.03), q, new THREE.Vector3().setScalar(r * s))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i++, c.set(toneAt(f.tone.index + fl.shift + b * 0.2).base))
    }
  })
  plane.add(mesh)
}

/**
 * Borla vellosa: una esfera con el contorno irregular (estambres que sobresalen). La
 * silueta perfecta de una esfera es lo que delata el plástico; esta se deshace en el borde.
 */
function fuzzyBall(seed: number): THREE.BufferGeometry {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv'))
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const h = Math.abs(Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + seed * 17.3) * 43758.5453) % 1
    v.multiplyScalar(0.86 + h * 0.3)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  // El shader de materiales usa uv; la borla no la necesita pero el atributo debe existir.
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2))
  return g
}

// ---------------------------------------------------------------------------
// Papel, papel de seda y lazo
// ---------------------------------------------------------------------------

function buildWrap(root: THREE.Group, b: Bouquet, toWorld: (x: number, y: number) => THREE.Vector3, k: number, mat: Materials, track: Track, girth = 1): { tip: THREE.Vector3; height: number; R: number } {
  const { wrap, bind } = b
  const { spread, drop, rise, ruffle } = wrap.shape
  const tip = toWorld(bind.x, bind.y + drop)
  const top = toWorld(bind.x, bind.y - rise)
  const height = top.y - tip.y
  // `girth`: con flores reales, un cono más fino (el ramo delicado no es todo papel).
  const R = spread * k * 0.82 * girth

  // Cono de papel: torno con el borde superior ondulado y sombreado de pliegues.
  const cone = (radius: number, h: number, scallops: number, waves: number, paperBase: string, paperFold: string, open: number) => {
    const segs = 160
    const rows = 28
    const positions: number[] = []
    const colors: number[] = []
    const idx: number[] = []
    const cb = col(paperBase)
    const cf = col(paperFold)
    const tmp = new THREE.Color()
    for (let r = 0; r <= rows; r++) {
      const v = r / rows
      for (let sgm = 0; sgm <= segs; sgm++) {
        const a = open / 2 + (sgm / segs) * (Math.PI * 2 - open)
        // Pliegues de florista (aristas marcadas que se abren hacia arriba) y arrugas finas: un
        // cono perfecto es lo que hace que el papel parezca plástico.
        const pleat = (1 - Math.abs(Math.sin(a * 4.5 + v * 0.6))) ** 3 * 0.045 * v
        const crumple = (Math.sin(a * 23 + v * 17) * Math.sin(a * 11 - v * 29) + Math.sin(a * 41 + v * 7) * 0.5) * 0.012 * (0.3 + v)
        const rad = (0.04 + radius * (0.15 * v + 0.85 * v ** 0.92)) * (1 + pleat + crumple)
        const edge =
          v === 1
            ? (scallops > 0 ? Math.abs(Math.sin(a * scallops * 0.5)) * 0.35 : Math.sin(a * waves) * 0.18 * ruffle) * h * 0.12
            : 0
        positions.push(Math.sin(a) * rad, v * h + edge, Math.cos(a) * rad)
        // Pliegues: bandas más oscuras, y el papel se oscurece hacia el pico.
        const fold = Math.pow(Math.abs(Math.sin(a * 3.5)), 6)
        const seam = Math.exp(-((a - 0.35) ** 2) / 0.004) * 0.9
        tmp.copy(cb).lerp(cf, Math.min(1, fold * 0.8 + (1 - v) * 0.25 + seam))
        colors.push(tmp.r, tmp.g, tmp.b)
      }
    }
    const stride = segs + 1
    for (let r = 0; r < rows; r++)
      for (let sgm = 0; sgm < segs; sgm++) {
        const a = r * stride + sgm
        idx.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return track(g)
  }

  // Seda interior: por dentro del papel y más alta, así solo asoma por encima del borde
  // como un volante festoneado.
  const tissue = new THREE.Mesh(cone(R * 0.97, height * 1.16, wrap.scallops, 0, wrap.tissue.base, wrap.tissue.shade, 0), mat.tissue)
  tissue.position.copy(tip)
  root.add(tissue)
  // Papel: cono cerrado; la costura donde se solapan las dos hojas va marcada en el color.
  const paper = new THREE.Mesh(cone(R, height, 0, 5, wrap.paper.base, wrap.paper.edge, 0), mat.paper)
  paper.position.copy(tip)
  root.add(paper)

  // Lazo: cinta alrededor del cuello, dos bucles y dos colas.
  const bowY = toWorld(bind.x, bind.y + drop * 0.46).y
  const v = (bowY - tip.y) / height
  const neck = 0.04 + R * (0.15 * v + 0.85 * v ** 0.92)
  const ribbon = mat.ribbon
  ribbon.color.set(wrap.ribbon.base)
  const band = new THREE.Mesh(track(new THREE.TorusGeometry(neck + 0.02, 0.022, 8, 64)), ribbon)
  band.rotation.x = Math.PI / 2
  band.scale.z = 1.8
  band.position.set(0, bowY, 0)
  root.add(band)
  const loopSize = wrap.bowSize * k * 0.55
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(track(new THREE.TorusGeometry(loopSize, 0.02, 8, 48)), ribbon)
    loop.scale.set(1, 0.55, 1.6)
    loop.position.set(side * loopSize * 0.9, bowY + 0.05, neck + 0.05)
    loop.rotation.set(0.2, side * 0.35, side * 0.5)
    root.add(loop)
    const tail = new THREE.Mesh(track(new THREE.PlaneGeometry(0.08, loopSize * 2.6)), ribbon)
    tail.position.set(side * 0.18, bowY - loopSize * 1.1, neck + 0.06)
    tail.rotation.set(0.15, 0, side * 0.35)
    root.add(tail)
  }
  const knot = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 12, 8)), ribbon)
  knot.position.set(0, bowY, neck + 0.08)
  knot.scale.set(1, 0.85, 0.7)
  root.add(knot)
  return { tip, height, R }
}

/**
 * Relleno de florista: ramitas de paniculata (florecillas blancas diminutas) que asoman
 * entre las flores, y una falda de hojas en el borde de la cúpula. Aparecen con el papel.
 */
function buildFiller(root: THREE.Group, bindW: THREE.Vector3, domeC: THREE.Vector3, domeR: number, n: number, k: number, mat: Materials, track: Track, rng: Rng, real = false) {
  // Pocas: acompañan sin quitar protagonismo al amarillo. Con flores reales, ninguna: la
  // paniculata procedural parece de cuentas al lado de un escaneo.
  const sprigs = real ? 0 : 3 + Math.round(n * 0.15)
  const stems: THREE.BufferGeometry[] = []
  const florets: THREE.Vector3[] = []
  const base = bindW.clone().add(new THREE.Vector3(0, -0.6, 0))
  for (let s = 0; s < sprigs; s++) {
    const theta = THREE.MathUtils.degToRad(rng.range(12, 78))
    const phi = rng.next() * Math.PI * 2
    const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi))
    const tip = domeC.clone().add(dir.clone().multiplyScalar(domeR * rng.range(0.8, 1.02)))
    const mid = base.clone().lerp(tip, 0.55).add(dir.clone().multiplyScalar(0.4))
    stems.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, mid, tip), 16, 0.016, 4, false))
    // Ramificación: varias ramitas cortas con racimos de florecillas.
    const branches = rng.int(3, 4)
    for (let b = 0; b < branches; b++) {
      const bdir = dir.clone().add(new THREE.Vector3(rng.range(-0.8, 0.8), rng.range(-0.2, 0.6), rng.range(-0.8, 0.8))).normalize()
      const bend = tip.clone().add(bdir.clone().multiplyScalar(rng.range(0.25, 0.55)))
      stems.push(new THREE.TubeGeometry(new THREE.LineCurve3(tip, bend), 2, 0.009, 3, false))
      for (let f = 0, count = rng.int(5, 8); f < count; f++) {
        florets.push(bend.clone().add(new THREE.Vector3(rng.gauss(0, 0.12), rng.gauss(0, 0.1), rng.gauss(0, 0.12))))
      }
    }
  }
  const merged = stems.length ? mergeGeometries(stems) : null
  for (const g of stems) g.dispose()
  if (merged) root.add(new THREE.Mesh(track(merged), mat.stem))
  const ball = track(fuzzyBall(2))
  const cloud = new THREE.InstancedMesh(ball, mat.filler, florets.length)
  const m = new THREE.Matrix4()
  florets.forEach((p, i) => {
    m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(i, i * 1.7, 0)), new THREE.Vector3().setScalar(rng.range(0.028, 0.048)))
    cloud.setMatrixAt(i, m)
  })
  root.add(cloud)

  // Falda de hojas en el borde de la cúpula, hacia fuera y algo caídas.
  // Delicado: poco follaje, solo un marco verde fino.
  const skirt = mat.photoLeaf ? 7 + Math.round(n * 0.25) : 14 + Math.round(n * 0.5)
  const geo = track(mat.photoLeaf ? photoLeafGeometry(30, 0.15) : leafGeometry(56, 13, 0.4, [col(GREENS.deep), col(GREENS.mid), col(GREENS.light)]))
  const leaves = new THREE.InstancedMesh(geo, mat.photoLeaf ?? mat.leaf, skirt)
  for (let i = 0; i < skirt; i++) {
    const phi = (i / skirt) * Math.PI * 2 + rng.range(-0.15, 0.15)
    const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi))
    // Por encima de la boca del papel (con la cúpula compacta, la boca queda más arriba respecto
    // al centro): así las hojas salen del ramo y no atraviesan el papel.
    const at = domeC.clone().add(out.clone().multiplyScalar(domeR * rng.range(0.5, 0.68))).add(new THREE.Vector3(0, domeR * (real ? 0.42 : 0.2), 0))
    // Hacia fuera y algo caídas, como la falda verde de un ramo.
    const q = new THREE.Quaternion().setFromUnitVectors(Y, out.clone().add(new THREE.Vector3(0, rng.range(-0.25, 0.2), 0)).normalize())
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng.range(-0.6, 0.6)))
    const sc = k * rng.range(1.05, 1.45)
    m.compose(at, q, new THREE.Vector3(sc, sc, sc))
    leaves.setMatrixAt(i, m)
  }
  root.add(leaves)
}

/**
 * Follaje de relleno: una corona de hojas que salen de la boca del cono hacia fuera, como
 * hacen los floristas para que no se vean los tallos desnudos. Más hojas cuantas menos flores.
 */
function buildGreenery(root: THREE.Group, b: Bouquet, toWorld: (x: number, y: number) => THREE.Vector3, k: number, mat: Materials, track: Track, rng: Rng, girth = 1) {
  const { bind, wrap } = b
  const mouth = toWorld(bind.x, bind.y - wrap.shape.rise)
  const R = wrap.shape.spread * k * 0.82 * girth
  // Con hojas reales: una cama que tapa toda la boca del papel (sin huecos al interior).
  const count = mat.photoLeaf ? 14 : Math.max(8, 16 - b.flowers.length)
  const geo = track(mat.photoLeaf ? photoLeafGeometry(30, 0.12) : leafGeometry(50, 12, 0.3, [col(GREENS.deep), col(GREENS.mid), col(GREENS.light)]))
  const leaves = new THREE.InstancedMesh(geo, mat.photoLeaf ?? mat.leaf, count)
  const m = new THREE.Matrix4()
  for (let i = 0; i < count; i++) {
    const az = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2)
    const out = new THREE.Vector3(Math.sin(az), 0, Math.cos(az))
    // Sale del borde, inclinada hacia fuera y hacia arriba, girada sobre sí misma.
    const dir = out.clone().multiplyScalar(rng.range(0.55, 0.9)).add(new THREE.Vector3(0, 1, 0)).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(Y, dir)
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng.range(-0.6, 0.6)))
    const pos = mouth.clone().add(out.multiplyScalar(R * (mat.photoLeaf ? rng.range(0.15, 0.85) : rng.range(0.7, 0.95)))).add(new THREE.Vector3(0, 0.05, 0))
    const sc = k * rng.range(1.3, 1.7)
    m.compose(pos, q, new THREE.Vector3(sc, sc, sc))
    leaves.setMatrixAt(i, m)
  }
  root.add(leaves)
}

/**
 * Relleno del ramo: girasoles pequeños, sin tallo, en los huecos
 * entre las flores principales (otra espiral áurea, desfasada y algo más adentro de la
 * cúpula). Así no se ve el fondo ni el interior del papel entre cabezas. Aparecen con el papel.
 */
function buildBed(
  root: THREE.Group,
  domeC: THREE.Vector3,
  domeR: number,
  thetaMax: number,
  n: number,
  k: number,
  models: BouquetModels,
  reveal: ReturnType<typeof createRevealUniforms>,
  ao: ReturnType<typeof createAoUniform>,
  extra: THREE.Material[],
  rng: Rng,
) {
  const kinds = [models.sunflower].filter((m): m is FlowerModel => !!m)
  if (kinds.length === 0) return
  const mats = kinds.map((m, i) => {
    const mm = createHeadMaterial(m.map, reveal, ao, i === 0 ? '#ffffff' : '#ffe58a')
    extra.push(mm)
    return mm
  })
  const count = Math.round(10 + n * 0.8)
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const theta = Math.acos(1 - t * (1 - Math.cos(thetaMax * 1.02)))
    const phi = i * 2.39996 + 1.2 + rng.range(-0.2, 0.2)
    const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi))
    const pos = domeC.clone().add(dir.clone().multiplyScalar(domeR * rng.range(0.74, 0.9)))
    const which = rng.next() < 0.65 ? 0 : Math.min(1, kinds.length - 1)
    const mesh = new THREE.Mesh(kinds[which]!.geometry, mats[which]!)
    mesh.quaternion.setFromUnitVectors(Z, dir.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize())
    mesh.rotateZ(rng.next() * Math.PI * 2)
    mesh.position.copy(pos)
    mesh.scale.setScalar(k * rng.range(12, 17))
    root.add(mesh)
  }
}

// ---------------------------------------------------------------------------
// Muestreo de superficie
// ---------------------------------------------------------------------------

/**
 * Reparte `n` puntos por la superficie del ramo, proporcional al área de cada malla (los
 * pétalos pesan más: son lo que tiene que leerse). Soporta mallas instanciadas.
 */
export type Samples = { pos: Float32Array; col: Float32Array; nor: Float32Array }

/**
 * Color de un punto de la cabeza de girasol según su distancia al centro (la geometría está
 * normalizada: radio 1, cara hacia +Z). El escaneo tiene el disco verdoso: en partículas,
 * lo que hace leer un girasol es el disco oscuro con su anillo y la corona dorada.
 */
function sunflowerColor(p: THREE.Vector3, out: THREE.Color, rng: Rng): THREE.Color {
  const r = Math.hypot(p.x, p.y)
  const j = rng.next()
  if (r < 0.26) return out.setRGB(0.16 + j * 0.08, 0.08 + j * 0.04, 0.02) // disco
  if (r < 0.33) return out.setRGB(0.42 + j * 0.1, 0.22 + j * 0.06, 0.04) // anillo
  const t = Math.min(1, (r - 0.33) / 0.6)
  return out.setRGB(0.95, 0.46 + t * 0.26 + j * 0.06, 0.0 + t * 0.04) // pétalos: ámbar → oro
}

/** Lee el color de una textura en (u, v), sobre una copia reducida en un canvas. */
function texelReader(map: THREE.Texture, region?: 'leaf' | 'stem'): ((u: number, v: number, out: THREE.Color) => THREE.Color) | null {
  const img = map.image as CanvasImageSource | undefined
  if (!img || typeof document === 'undefined') return null
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  return (u0, v0, out) => {
    const [u, v] = region ? atlasUv(region, u0, v0) : [u0, v0]
    const x = Math.min(size - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * size)))
    const yy = map.flipY ? 1 - v : v
    const y = Math.min(size - 1, Math.max(0, Math.floor((((yy % 1) + 1) % 1) * size)))
    const i = (y * size + x) * 4
    // Fuera de la silueta (transparente, recortada por alphaTest): verde hoja.
    if (data[i + 3]! < 128) return out.setRGB(0.12, 0.3, 0.1)
    return out.setRGB(data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255, THREE.SRGBColorSpace)
  }
}

function sampleSurface(
  root: THREE.Object3D,
  n: number,
  seed: string,
  skip?: (mesh: THREE.Mesh) => boolean,
  ownerOf?: (mesh: THREE.Mesh) => number,
): Samples & { owner: Int16Array } {
  const rng = createRng(`muestreo:${seed}`)
  type Source = {
    sampler: MeshSurfaceSampler
    mesh: THREE.Mesh
    instances: number
    weight: number
    color: THREE.Color
    hasVertexColor: boolean
    texel: ((u: number, v: number, out: THREE.Color) => THREE.Color) | null
    /** Cabeza de girasol: color por posición (disco oscuro, pétalos dorados). */
    head: boolean
  }
  const sources: Source[] = []
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || skip?.(o)) return
    const geo = o.geometry as THREE.BufferGeometry
    // Área aproximada: triángulos de la geometría × instancias × escala media al cuadrado.
    let area = 0
    const p = geo.getAttribute('position')
    const idx = geo.getIndex()
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    const tri = (i0: number, i1: number, i2: number) => {
      a.fromBufferAttribute(p, i0)
      b.fromBufferAttribute(p, i1)
      c.fromBufferAttribute(p, i2)
      area += b.sub(a).cross(c.sub(a)).length() / 2
    }
    if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2))
    else for (let i = 0; i < p.count; i += 3) tri(i, i + 1, i + 2)
    // Escala real de la superficie: la del objeto y, en las mallas instanciadas, la media
    // de sus instancias (los pétalos se escalan en la matriz de cada instancia).
    const s = new THREE.Vector3()
    o.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s)
    let areaScale = Math.abs(s.x * s.y)
    const instances = o instanceof THREE.InstancedMesh ? o.count : 1
    if (o instanceof THREE.InstancedMesh) {
      const m = new THREE.Matrix4()
      const si = new THREE.Vector3()
      let sum = 0
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m)
        m.decompose(new THREE.Vector3(), new THREE.Quaternion(), si)
        sum += Math.abs(si.x * si.y)
      }
      areaScale *= sum / Math.max(1, o.count)
    }
    const material = o.material as THREE.MeshStandardMaterial
    const kind = material.userData.kind as string | undefined
    // Las cabezas de girasol se llevan la mayoría de puntos (son lo que se tiene que leer).
    const weight = area * instances * areaScale * (kind === 'head' ? 5 : kind === 'petal' ? 2.2 : kind === 'stem' ? 0.8 : 0.7)
    const sampler = new MeshSurfaceSampler(o)
    // Muestreo determinista: mismo nombre, mismas partículas. (setRandomGenerator existe en
    // Three.js pero falta en @types/three.)
    ;(sampler as unknown as { setRandomGenerator: (fn: () => number) => void }).setRandomGenerator(() => rng.next())
    sources.push({
      sampler: sampler.build(),
      mesh: o,
      instances,
      weight,
      color: material.color.clone(),
      hasVertexColor: !!material.vertexColors && !!geo.getAttribute('color'),
      head: kind === 'head',
      texel: material.map ? texelReader(material.map, material.userData.atlas as 'leaf' | 'stem' | undefined) : null,
    })
  })

  const total = sources.reduce((sum, s) => sum + s.weight, 0) || 1
  const pos = new Float32Array(n * 4)
  const colors = new Float32Array(n * 4)
  const normals = new Float32Array(n * 3)
  const owner = new Int16Array(n)
  const nm = new THREE.Matrix3()
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const color = new THREE.Color()
  const inst = new THREE.Matrix4()
  const instColor = new THREE.Color()
  const uv = new THREE.Vector2()
  const texColor = new THREE.Color()
  let written = 0
  sources.forEach((src, si) => {
    const count = si === sources.length - 1 ? n - written : Math.round((src.weight / total) * n)
    for (let k = 0; k < count && written < n; k++) {
      src.sampler.sample(point, normal, color, uv)
      let c = src.head ? sunflowerColor(point, texColor, rng) : src.texel ? src.texel(uv.x, uv.y, texColor) : src.hasVertexColor ? color : src.color
      if (src.mesh instanceof THREE.InstancedMesh) {
        const which = Math.floor(rng.next() * src.instances)
        src.mesh.getMatrixAt(which, inst)
        point.applyMatrix4(inst)
        normal.applyMatrix3(nm.getNormalMatrix(inst))
        if (src.mesh.instanceColor) {
          src.mesh.getColorAt(which, instColor)
          c = c.clone().multiply(instColor)
        }
      }
      point.applyMatrix4(src.mesh.matrixWorld)
      normal.applyMatrix3(nm.getNormalMatrix(src.mesh.matrixWorld))
      if (normal.lengthSq() < 1e-10) normal.set(0, 0, 1)
      normal.normalize()
      owner[written] = ownerOf?.(src.mesh) ?? 0
      normals[written * 3] = normal.x
      normals[written * 3 + 1] = normal.y
      normals[written * 3 + 2] = normal.z
      const i = written * 4
      pos[i] = point.x
      pos[i + 1] = point.y
      pos[i + 2] = point.z
      pos[i + 3] = 0
      // Color en espacio de pantalla (sRGB) para las partículas.
      const out = c.clone().convertLinearToSRGB()
      colors[i] = out.r
      colors[i + 1] = out.g
      colors[i + 2] = out.b
      colors[i + 3] = 0.9
      written++
    }
  })
  return { pos, col: colors, nor: normals, owner }
}
