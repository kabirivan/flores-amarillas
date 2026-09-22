/**
 * Motor 3D de la historia. Se carga con import() al pulsar «Comenzar»: la portada no paga
 * el peso de Three.js.
 *
 * Un único bucle: suaviza el progreso del scroll, pide a la timeline el estado de la escena
 * y actualiza cielo, partículas y cámara. Se pausa con la pestaña oculta.
 */

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { CAMERAS, CHAPTERS, SHAPES, flowerRevealFor, liftFor, sceneAt, wrapFor, type CameraKey } from './timeline'
import { tourCamera } from './tour'
import { createSky } from './sky'
import { MAX_BOUQUET, createMorphParticles } from './particles/morph'
import { GROUND, blocksFor, bouquetMembership, gardenShape } from './particles/shapes'
import { gardenLayout } from './garden/layout'
import { buildBouquet3D } from './bouquet3d/build'
import { createSpin } from './bouquet3d/controls'
import { createButterflies } from './butterflies'
import { createComets } from './comets'
import type { BouquetModels } from './bouquet3d/models'
import { cyrb128 } from '@/lib/bouquet/prng'
import type { Bouquet } from '@/lib/bouquet/types'

export type Quality = { particles: number; flowers: number; bouquet: number; dpr: number; bloom: boolean }

export function pickQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const cores = navigator.hardwareConcurrency ?? 4
  if (coarse || small || cores <= 4) return { particles: 26000, flowers: 110, bouquet: 30000, dpr: Math.min(1.5, window.devicePixelRatio || 1), bloom: false }
  return { particles: 64000, flowers: 240, bouquet: 90000, dpr: Math.min(2, window.devicePixelRatio || 1), bloom: true }
}

export type StoryEngine = {
  /** Progreso objetivo del scroll (0–1); el motor lo alcanza suavemente. */
  setProgress: (p: number) => void
  /** Posición del cursor en [-1, 1] para el paralaje de cámara. */
  setPointer: (x: number, y: number) => void
  /** Arnés ?p=N: dibuja ese instante exacto y detiene el bucle. */
  freeze: (p: number, time?: number, rotationDeg?: number) => void
  dispose: () => void
  quality: Quality
  /** Métricas del último fotograma (llamadas de dibujo, puntos, triángulos). */
  stats: () => { calls: number; points: number; triangles: number }
}

export function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export type EngineOptions = {
  /** Arnés de verificación: conserva el búfer para que las capturas no lo pierdan. */
  harness?: boolean
  /** Flores de modelos reales ya cargadas (ver loadBouquetModels). */
  models?: BouquetModels
}

export { loadBouquetModels } from './bouquet3d/models'

export function createStoryEngine(canvas: HTMLCanvasElement, bouquet: Bouquet, options: EngineOptions = {}): StoryEngine {
  const seed = bouquet.seed
  const quality = pickQuality()
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.harness === true,
  })
  renderer.setPixelRatio(quality.dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // Mapeo de tonos ACES: comparado con Neutral, mantiene el amarillo de los pétalos (Neutral
  // los viraba a albaricoque) y el naranja del horizonte. Con bloom se aplica al final a
  // toda la imagen (OutputPass); sin bloom, solo al ramo real.
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  const sky = createSky()
  scene.add(sky.mesh)

  // El jardín de luz: cada capítulo es un estado del mismo jardín.
  const N = quality.particles
  const flowers = buildBouquet3D(bouquet, options.models)
  const layout = gardenLayout(seed, quality.flowers, Math.min(MAX_BOUQUET, flowers.count))
  const [h] = cyrb128(`particulas:${seed}`)
  const particles = createMorphParticles(N, SHAPES.length, h, bouquetMembership(N, layout))
  SHAPES.forEach((state, i) => particles.setShape(i, gardenShape(state, N, layout, seed)))

  // Destinos del vuelo: cada flor amarilla elegida aterriza sobre su flor del ramo 3D.
  const targets = new Float32Array(N * 4)
  const blocks = blocksFor(N, layout)
  layout.flowers.forEach((f, i) => {
    if (f.bouquet < 0) return
    const b = blocks.flowers[i]!
    targets.set(flowers.sampleFlower(f.bouquet, b.count, seed).pos, b.start * 4)
  })
  particles.setBouquetTargets(targets)

  // El ramo es de luz: el molde 3D solo sirve para muestrear su superficie.
  flowers.lightUp(quality.bouquet, seed)
  flowers.setReveal(0)
  scene.add(flowers.root)
  const spin = createSpin(flowers.root)
  scene.add(particles.points)
  const lifts = particles.material.uniforms.uLift?.value as number[]

  // Estelas de los cometas: una cinta dorada por flor del ramo, del jardín a su sitio.
  const comets = createComets(flowers.count, 0.07)
  scene.add(comets.group)
  const cometFrom = Array.from({ length: flowers.count }, () => new THREE.Vector3())
  for (const f of layout.flowers) {
    if (f.bouquet >= 0) cometFrom[f.bouquet]?.set(f.x + f.tilt * 0.35, GROUND + f.height, f.z)
  }

  // Entorno para reflejos y volumen del ramo real (no afecta a las partículas).
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap
  scene.environmentIntensity = 0.22
  pmrem.dispose()

  // Luz de atardecer: cenital cálida, principal dorada, contraluz del horizonte y relleno lila.
  const hemi = new THREE.HemisphereLight('#ffd9b0', '#2a1e2e', 1.1)
  scene.add(hemi)
  const key = new THREE.DirectionalLight('#fff3d6', 1.75)
  key.position.set(-4, 6, 8)
  const rim = new THREE.DirectionalLight('#ffb070', 1.6)
  rim.position.set(3, 3, -6)
  const fill = new THREE.DirectionalLight('#b9a6ff', 0.7)
  fill.position.set(5, -2, 4)
  scene.add(key, rim, fill)
  // Luz del ramo real: la del atardecer lo teñía de naranja. Al hacerse real, la luz pasa a
  // una de estudio casi neutra (el cielo sigue cálido; las flores, con su amarillo limpio).
  const LIGHTS = {
    dusk: { hemi: new THREE.Color('#ffd9b0'), key: new THREE.Color('#fff3d6'), rim: new THREE.Color('#ffb070'), keyI: 1.75, rimI: 1.6, hemiI: 1.1 },
    // Luz envolvente (mucho relleno, poca direccional): sombras suaves, aspecto delicado.
    real: { hemi: new THREE.Color('#fffaf2'), key: new THREE.Color('#fffaf0'), rim: new THREE.Color('#fff0d8'), keyI: 1.5, rimI: 1.3, hemiI: 1.8 },
  }
  const setLight = (t: number) => {
    const { dusk, real } = LIGHTS
    hemi.color.copy(dusk.hemi).lerp(real.hemi, t)
    key.color.copy(dusk.key).lerp(real.key, t)
    rim.color.copy(dusk.rim).lerp(real.rim, t)
    hemi.intensity = dusk.hemiI + (real.hemiI - dusk.hemiI) * t
    key.intensity = dusk.keyI + (real.keyI - dusk.keyI) * t
    rim.intensity = dusk.rimI + (real.rimI - dusk.rimI) * t
  }

  // Bloom (solo escritorio): resplandor real sobre lo que brilla — luciérnagas, cometas,
  // el ramo de luz, el borde de la materialización y el horizonte.
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  if (quality.bloom) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }))
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 0.86)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    // Los shaders propios pasan a emitir color lineal.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material
      if (m instanceof THREE.ShaderMaterial) {
        m.defines = { ...m.defines, FA_LINEAR: '' }
        m.needsUpdate = true
      }
    })
  }

  // Mariposas del final: vuelan alrededor del ramo; una se posa en la flor principal.
  // Cerca del ramo y, otra bandada, a lo lejos.
  const butterflies = createButterflies(quality.bloom ? 6 : 5, seed, quality.bloom ? 10 : 6)
  scene.add(butterflies.group)
  // La flor principal en coordenadas del ramo: si se gira el ramo, la mariposa gira con él.
  const restLocal = flowers.root.worldToLocal(flowers.focus.clone().add(new THREE.Vector3(0, 0.12, 0.05)))
  const restWorld = new THREE.Vector3()
  const finalIndex = CHAPTERS.findIndex((ch) => ch.id === 'final')

  const u = particles.material.uniforms
  const setU = (name: string, value: number) => {
    const uniform = u[name]
    if (uniform) uniform.value = value
  }

  let width = 1
  let height = 1
  let baseFov = 42
  const resize = () => {
    width = canvas.clientWidth || window.innerWidth
    height = canvas.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    composer?.setPixelRatio(renderer.getPixelRatio())
    composer?.setSize(width, height)
    camera.aspect = width / height
    // En vertical, la cámara se aleja para que el ramo quepa a lo ancho.
    baseFov = camera.aspect < 0.8 ? 58 : 42
    camera.fov = baseFov
    camera.updateProjectionMatrix()
    setU('uPixelRatio', renderer.getPixelRatio())
    // Píxeles por unidad de mundo a distancia 1: el tamaño de los puntos del ramo.
    flowers.setView(renderer.getPixelRatio(), height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))))
  }
  resize()
  window.addEventListener('resize', resize)

  let target = 0
  let progress = 0
  /** Velocidad del scroll suavizada (progreso por segundo) y su intensidad 0–1. */
  let velocity = 0
  let breath = 0
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  let time = 0
  let raf = 0
  let last = performance.now()
  let frozen = false
  const look = new THREE.Vector3()
  const viewDir = new THREE.Vector3()

  const ramoIndex = CHAPTERS.findIndex((ch) => ch.id === 'ramo')
  /** Plano del ramo entero: a la distancia justa para que quepa, algo por encima del texto. */
  const bouquetShot = (margin: number) => {
    const r = flowers.radius * margin
    const dist = r / Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * 0.9
    const c = flowers.center
    return { x: c.x, y: c.y + r * 0.1, z: c.z + dist, tx: c.x, ty: c.y - r * 0.3, tz: c.z }
  }

  const blendCam = (a: CameraKey, b: CameraKey, t: number): CameraKey => {
    const k = Math.min(1, Math.max(0, t))
    const e = k * k * (3 - 2 * k)
    return {
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
      z: a.z + (b.z - a.z) * e,
      tx: a.tx + (b.tx - a.tx) * e,
      ty: a.ty + (b.ty - a.ty) * e,
      tz: a.tz + (b.tz - a.tz) * e,
    }
  }

  function render(dt: number) {
    time += dt
    const s = sceneAt(progress)
    particles.use(s.from, s.to)
    setU('uMix', s.mix)
    setU('uTime', time)
    // Respiración: el scroll rápido levanta ráfagas y remolinos; al parar, se calma.
    setU('uTurb', s.turbulence + breath * 0.45)
    setU('uWind', s.wind + breath * 1.4)
    setU('uVelocity', breath)
    setU('uCrisp', 0)
    setU('uFade', s.real)

    // El ramo flor a flor: vuelo de cada cometa y aparición de su flor al aterrizar.
    if (s.assemble === null) {
      lifts.fill(0)
      for (let k = 0; k < flowers.count; k++) comets.hide(k)
      flowers.setReveal(0)
    } else {
      for (let k = 0; k < flowers.count; k++) {
        const lift = liftFor(s.assemble, flowers.orderOf(k), flowers.count)
        lifts[k] = lift
        flowers.setFlowerReveal(k, flowerRevealFor(lift))
        const head = flowers.heads[k]
        const from = cometFrom[k]
        // La cabeza de la estela va con las partículas más adelantadas del cometa.
        const lead = lift >= 0.82 ? 1 : (lift / 0.82) ** 2 * (3 - (2 * lift) / 0.82)
        if (head && from && s.real < 1) comets.update(k, from, head, lead, camera.position)
        else comets.hide(k)
      }
      flowers.setWrapReveal(wrapFor(s.assemble))
    }
    // Al terminar de formarse, el ramo de luz se convierte en el ramo real. Con el ramo
    // real, menos resplandor: el jardín y los cometas brillan; el ramo, no.
    // El ramo es solo de partículas (girasoles de luz que fluyen): nunca se vuelve sólido.
    flowers.setReal(0)
    setLight(s.real)
    if (bloom) {
      // Con el ramo real, un resplandor suave y amplio (efecto de ensueño) en vez del brillo
      // de las partículas: poca fuerza, umbral algo más bajo, radio grande.
      bloom.strength = 0.45 + (0.24 - 0.45) * s.real
      bloom.threshold = 0.86 + (0.9 - 0.86) * s.real
      bloom.radius = 0.5 + 0.4 * s.real
    }
    // Las mariposas llegan con el final.
    const appear = s.chapter === finalIndex ? Math.min(1, s.local / 0.35) : 0
    // Mientras llegan las mariposas, el jardín de partículas se apaga.
    setU('uHide', appear * appear * (3 - 2 * appear))
    particles.points.visible = appear < 0.999
    flowers.root.localToWorld(restWorld.copy(restLocal))
    butterflies.update(time, appear * appear * (3 - 2 * appear), flowers.center, flowers.radius, restWorld)
    flowers.update(time)
    spin.setEnabled(s.interactive && !frozen)
    spin.update(dt)

    // Cámara: la de la timeline más un paralaje suave con el cursor.
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3)
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3)
    // Del ramo en adelante la cámara encuadra el ramo según su tamaño real (más flores, más
    // lejos); en la contemplación manda el recorrido (acercarse, 360°, alejarse).
    const tourFrom = bouquetShot(1.15)
    const tourTo = bouquetShot(1)
    // El recorrido se adapta al tamaño del ramo (más flores, órbita más amplia).
    const c =
      s.tour !== null
        ? tourCamera(s.tour, tourFrom, tourTo, flowers.focus, flowers.center, flowers.radius / 3.9)
        : s.chapter > ramoIndex
          ? tourTo
          : s.chapter === ramoIndex
            ? blendCam(CAMERAS[ramoIndex - 1] ?? tourFrom, tourFrom, s.local / 0.7)
            : s.camera
    // Paralaje del cursor: menos en los primeros planos.
    const par = s.tour === null ? 1 : 0.25
    camera.position.set(c.x + pointer.sx * 0.8 * par, c.y - pointer.sy * 0.5 * par, c.z)
    look.set(c.tx, c.ty, c.tz)
    camera.lookAt(look)
    // Un leve golpe de FOV con la velocidad: sensación de impulso.
    const fov = baseFov + breath * 2.5
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    setU('uFocus', camera.position.distanceTo(look))

    viewDir.subVectors(look, camera.position).normalize()
    sky.update(s.sky, time, camera.aspect, Math.asin(Math.max(-1, Math.min(1, viewDir.y))), camera.fov)
    if (composer) composer.render(dt)
    else renderer.render(scene, camera)
  }

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    // Suavizado amortiguado del scroll (independiente de los fps).
    const before = progress
    progress += (target - progress) * (1 - Math.exp(-dt * 5))
    // Velocidad suavizada: sube rápido y decae despacio.
    const raw = dt > 0 ? Math.abs(progress - before) / dt : 0
    velocity += (raw - velocity) * (1 - Math.exp(-dt * (raw > velocity ? 8 : 2.5)))
    breath = Math.min(1, velocity * 9)
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
    quality,
    stats() {
      const r = renderer.info.render
      return { calls: r.calls, points: r.points, triangles: r.triangles }
    },
    setProgress(p) {
      target = Math.min(1, Math.max(0, p))
    },
    setPointer(x, y) {
      pointer.x = x
      pointer.y = y
    },
    freeze(p, t = 3, rotationDeg = 0) {
      // Congela un instante exacto y lo repinta en cada fotograma (tras un scroll o un
      // redimensionado el navegador puede descartar el búfer de WebGL).
      frozen = true
      cancelAnimationFrame(raf)
      target = progress = p
      const paint = () => {
        time = t - 1 / 60
        render(1 / 60)
        if (rotationDeg) {
          flowers.root.rotation.y = THREE.MathUtils.degToRad(rotationDeg)
          if (composer) composer.render(0)
          else renderer.render(scene, camera)
        }
        raf = requestAnimationFrame(paint)
      }
      paint()
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      particles.dispose()
      flowers.dispose()
      butterflies.dispose()
      comets.dispose()
      envMap.dispose()
      bloom?.dispose()
      composer?.dispose()
      spin.dispose()
      sky.dispose()
      renderer.dispose()
    },
  }
}
