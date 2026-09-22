/**
 * Estelas de los cometas: cuando una flor amarilla vuela del jardín al ramo, deja una
 * cinta de luz dorada que se estrecha hacia la cola y se desvanece.
 *
 * Cada estela es una cinta orientada a la cámara sobre el mismo arco (Bézier cuadrática)
 * que siguen las partículas de su flor en el shader. La geometría se crea una vez; en cada
 * fotograma solo se reescriben las posiciones (sin reservar memoria).
 */

import * as THREE from 'three'

const SEGMENTS = 40
/** Largo de la estela, en fracción del vuelo. */
const TAIL = 0.32

const VERT = /* glsl */ `
attribute float aT;
attribute float aS;
varying float vT;
varying float vS;
void main() {
  vT = aT;
  vS = aS;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
uniform float uOpacity;
varying float vT;
varying float vS;
void main() {
  // Más brillante en la cabeza; borde suave a lo ancho.
  float a = pow(vT, 1.6) * (1.0 - vS * vS) * uOpacity;
  vec3 col = mix(vec3(1.0, 0.72, 0.28), vec3(1.0, 0.95, 0.75), vT);
  #ifdef FA_LINEAR
  col = pow(col, vec3(2.2));
  #endif
  gl_FragColor = vec4(col * a, a);
}
`

export type Comets = {
  group: THREE.Group
  /** Dibuja la estela k: del jardín (`from`) al ramo (`to`), con el vuelo en `lift` (0–1). */
  update: (k: number, from: THREE.Vector3, to: THREE.Vector3, lift: number, eye: THREE.Vector3) => void
  hide: (k: number) => void
  dispose: () => void
}

export function createComets(count: number, width: number): Comets {
  const group = new THREE.Group()
  group.name = 'estelas'
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: { uOpacity: { value: 0.9 } },
  })

  const ribbons = Array.from({ length: count }, () => {
    const verts = (SEGMENTS + 1) * 2
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const t = new Float32Array(verts)
    const s = new Float32Array(verts)
    for (let i = 0; i <= SEGMENTS; i++) {
      t[i * 2] = t[i * 2 + 1] = i / SEGMENTS
      s[i * 2] = -1
      s[i * 2 + 1] = 1
    }
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    geo.setAttribute('aS', new THREE.BufferAttribute(s, 1))
    const idx: number[] = []
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    geo.setIndex(idx)
    const mesh = new THREE.Mesh(geo, material)
    mesh.frustumCulled = false
    mesh.visible = false
    group.add(mesh)
    return mesh
  })

  const ctrl = new THREE.Vector3()
  const p = new THREE.Vector3()
  const next = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const toEye = new THREE.Vector3()
  const side = new THREE.Vector3()
  const bezier = (from: THREE.Vector3, to: THREE.Vector3, u: number, out: THREE.Vector3) => {
    const a = (1 - u) * (1 - u)
    const b = 2 * (1 - u) * u
    const c = u * u
    return out.set(a * from.x + b * ctrl.x + c * to.x, a * from.y + b * ctrl.y + c * to.y, a * from.z + b * ctrl.z + c * to.z)
  }

  return {
    group,
    update(k, from, to, lift, eye) {
      const mesh = ribbons[k]
      if (!mesh) return
      if (lift <= 0.001 || lift >= 0.999) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      // Mismo arco que el shader de partículas: el control sube con la distancia.
      ctrl.copy(from).lerp(to, 0.5)
      ctrl.y += 2.2 + from.distanceTo(to) * 0.25
      const head = lift
      const tail = Math.max(0, lift - TAIL)
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = pos.array as Float32Array
      for (let i = 0; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS
        const u = tail + (head - tail) * t
        bezier(from, to, u, p)
        bezier(from, to, Math.min(1, u + 0.01), next)
        tangent.subVectors(next, p).normalize()
        toEye.subVectors(eye, p).normalize()
        side.crossVectors(tangent, toEye).normalize()
        // Ancha en la cabeza, un hilo en la cola; se afina al llegar.
        const w = width * t ** 1.5 * Math.sin(Math.min(1, lift * 1.1) * Math.PI) ** 0.5
        arr[i * 6] = p.x - side.x * w
        arr[i * 6 + 1] = p.y - side.y * w
        arr[i * 6 + 2] = p.z - side.z * w
        arr[i * 6 + 3] = p.x + side.x * w
        arr[i * 6 + 4] = p.y + side.y * w
        arr[i * 6 + 5] = p.z + side.z * w
      }
      pos.needsUpdate = true
    },
    hide(k) {
      const mesh = ribbons[k]
      if (mesh) mesh.visible = false
    },
    dispose() {
      for (const r of ribbons) r.geometry.dispose()
      material.dispose()
    },
  }
}
