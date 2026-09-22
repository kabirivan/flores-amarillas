/**
 * La escena del ramo (sin historia): el ramo de girasoles de hilos sobre un jardín de líneas,
 * en una noche con estrellas, y las mariposas.
 *
 * Todo va por tiempo desde `start()`: primero el papel, luego cada girasol se traza hilo a
 * hilo, y al final llegan las mariposas. La cámara encuadra el ramo y se mece despacio; el
 * ramo se puede girar arrastrando. Se pausa con la pestaña oculta.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createSky } from './sky'
import { buildBouquet3D } from './bouquet3d/build'
import { createSpin } from './bouquet3d/controls'
import { createButterflies } from './butterflies'
import { createLineGarden } from './garden/lineGarden'
import type { Bouquet } from '@/lib/bouquet/types'

export type BouquetScene = {
  /** Empieza (o vuelve a empezar) a dibujar el ramo. */
  start: () => void
  /** Posición del cursor en [-1, 1] para el paralaje. */
  setPointer: (x: number, y: number) => void
  /** Arnés `?t=N`: dibuja el instante N (segundos desde el inicio) y se queda ahí. */
  freeze: (t: number) => void
  dispose: () => void
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const k = clamp01(v)
  return k * k * (3 - 2 * k)
}

/** Guion en segundos: papel, flores una a una (en su orden), mariposas. */
const WRAP = { at: 0.2, dur: 1.8 }
const FLOWERS = { at: 1.2, span: 3.2, dur: 1.8 }
const BUTTERFLIES = { at: 5.2, dur: 3 }

export function createBouquetScene(canvas: HTMLCanvasElement, bouquet: Bouquet, options: { harness?: boolean; reduced?: boolean } = {}): BouquetScene {
  const coarse = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: options.harness === true })
  renderer.setPixelRatio(Math.min(coarse ? 2 : 2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  const sky = createSky()
  scene.add(sky.mesh)

  // El ramo de hilos (las mallas solo sirven de molde; no se dibujan).
  const flowers = buildBouquet3D(bouquet)
  flowers.lightUp(1500, bouquet.seed)
  flowers.setReveal(0)
  flowers.setReal(0)
  scene.add(flowers.root)
  const spin = createSpin(flowers.root)
  spin.setEnabled(!options.harness)

  // Jardín de líneas alrededor.
  const gardenGroup = new THREE.Group()
  scene.add(gardenGroup)
  const garden = createLineGarden(gardenGroup, bouquet.seed, coarse ? { grass: 900, sunflowers: 26, lavender: 40 } : { grass: 2200, sunflowers: 60, lavender: 90 })
  garden.material.uniforms.uReveal!.value = 1

  // Luz para las mariposas (lo demás son hilos que emiten su propio color).
  scene.add(new THREE.HemisphereLight('#fff6e8', '#221a33', 1.6))
  const key = new THREE.DirectionalLight('#fffaf0', 1.4)
  key.position.set(-4, 6, 8)
  scene.add(key)

  const butterflies = createButterflies(coarse ? 5 : 6, bouquet.seed, coarse ? 6 : 10)
  scene.add(butterflies.group)
  const restLocal = flowers.root.worldToLocal(flowers.focus.clone().add(new THREE.Vector3(0, 0.12, 0.05)))
  const restWorld = new THREE.Vector3()

  // Bloom suave: los hilos cruzados brillan un poco (solo escritorio).
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (!coarse) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }))
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.7, 0.82)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material
      if (m instanceof THREE.ShaderMaterial) {
        m.defines = { ...m.defines, FA_LINEAR: '' }
        m.needsUpdate = true
      }
    })
  }

  let baseFov = 42
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    composer?.setPixelRatio(renderer.getPixelRatio())
    composer?.setSize(w, h)
    camera.aspect = w / h
    baseFov = camera.aspect < 0.8 ? 58 : 42
    camera.fov = baseFov
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  const look = new THREE.Vector3()
  const viewDir = new THREE.Vector3()
  let time = 0
  let since = -1 // segundos desde start(); -1 = aún no ha empezado
  let raf = 0
  let last = performance.now()
  let frozen = false

  const order = Array.from({ length: flowers.count }, (_, k) => flowers.orderOf(k))
  const gardenAlpha = garden.material.userData.alpha as number

  function render(dt: number) {
    time += dt
    if (since >= 0) since += dt
    const s = options.reduced ? 99 : Math.max(0, since)

    // El guion: papel → girasoles uno a uno → mariposas.
    flowers.setWrapReveal(since < 0 ? 0 : smooth((s - WRAP.at) / WRAP.dur))
    for (let k = 0; k < flowers.count; k++) {
      const at = FLOWERS.at + (flowers.count > 1 ? order[k]! / (flowers.count - 1) : 0) * FLOWERS.span
      flowers.setFlowerReveal(k, since < 0 ? 0 : smooth((s - at) / FLOWERS.dur))
    }
    garden.material.uniforms.uAlpha!.value = gardenAlpha * (since < 0 ? 0.35 : 0.35 + 0.65 * smooth(s / 2.5))
    garden.material.uniforms.uTime!.value = time
    const appear = since < 0 ? 0 : smooth((s - BUTTERFLIES.at) / BUTTERFLIES.dur)
    flowers.root.localToWorld(restWorld.copy(restLocal))
    butterflies.update(time, appear, flowers.center, flowers.radius, restWorld)
    flowers.update(time)
    spin.update(dt)

    // Cámara: el ramo entero, meciéndose despacio a los lados, con paralaje del cursor.
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3)
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3)
    const c = flowers.center
    const r = flowers.radius * 1.05
    const dist = (r / Math.tan(THREE.MathUtils.degToRad(baseFov / 2))) * 0.9
    const sway = options.reduced ? 0 : Math.sin(time * 0.12) * 0.22
    camera.position.set(c.x + Math.sin(sway) * dist + pointer.sx * 0.6, c.y + r * 0.18 - pointer.sy * 0.4, c.z + Math.cos(sway) * dist)
    look.set(c.x, c.y - r * 0.3, c.z)
    camera.lookAt(look)

    viewDir.subVectors(look, camera.position).normalize()
    sky.update(4, time, camera.aspect, Math.asin(Math.max(-1, Math.min(1, viewDir.y))), camera.fov)
    if (composer) composer.render(dt)
    else renderer.render(scene, camera)
  }

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    render(dt)
    raf = requestAnimationFrame(loop)
  }
  const onVisibility = () => {
    if (frozen) return
    if (document.hidden) cancelAnimationFrame(raf)
    else {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  raf = requestAnimationFrame(loop)

  return {
    start() {
      since = 0
    },
    setPointer(x, y) {
      pointer.x = x
      pointer.y = y
    },
    freeze(t) {
      frozen = true
      cancelAnimationFrame(raf)
      const paint = () => {
        since = t - 1 / 60
        time = t + 3 - 1 / 60
        render(1 / 60)
        raf = requestAnimationFrame(paint)
      }
      paint()
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      flowers.dispose()
      garden.points.geometry.dispose()
      ;(garden.points.userData.veil as THREE.BufferGeometry | undefined)?.dispose()
      garden.material.dispose()
      butterflies.dispose()
      bloom?.dispose()
      composer?.dispose()
      spin.dispose()
      sky.dispose()
      renderer.dispose()
    },
  }
}
