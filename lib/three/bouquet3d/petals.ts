/**
 * Geometría de pétalos y hojas en 3D. Se parte del mismo contorno que dibuja el SVG
 * (petalCommands / leafCommands) y se construye una rejilla: filas a lo largo del pétalo y
 * columnas a lo ancho, para poder ahuecarlo (copa) y curvarlo (puntas arqueadas) con
 * suavidad. Lleva color por vértice: base más profunda, punta que atrapa la luz.
 */

import * as THREE from 'three'
import { leafCommands, petalCommands, toOutline, type Cmd, type PetalShape } from '@/lib/bouquet/geometry'

export type Bend = {
  /** Ahuecado transversal: + los bordes vienen hacia el espectador (+Z). En unidades de largo. */
  cup: number
  /** Curvatura a lo largo: + la punta se arquea hacia +Z. En unidades de largo. */
  curl: number
  /** Pliegue en V a lo largo del nervio (hojas, y un surco suave en los pétalos). */
  fold?: number
  /** Ondulación del borde (0–1): los pétalos reales no tienen el borde recto. */
  ruffle?: number
}

type Row = { y: number; xl: number; xr: number }

/** Para cada altura, dónde empieza y acaba el contorno (el pétalo es convexo a lo ancho). */
function profile(outline: [number, number][], rows: number, length: number): Row[] {
  const out: Row[] = []
  for (let r = 0; r <= rows; r++) {
    // El SVG crece hacia −Y; en 3D el pétalo crece hacia +Y.
    const y = (r / rows) * length * 0.999
    let xl = Infinity
    let xr = -Infinity
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!
      const b = outline[(i + 1) % outline.length]!
      const ya = -a[1]
      const yb = -b[1]
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue
      const t = (y - ya) / (yb - ya)
      const x = a[0] + (b[0] - a[0]) * t
      xl = Math.min(xl, x)
      xr = Math.max(xr, x)
    }
    if (!Number.isFinite(xl)) {
      const prev = out[out.length - 1]
      xl = prev?.xl ?? 0
      xr = prev?.xr ?? 0
    }
    out.push({ y, xl, xr })
  }
  // La punta se cierra en un punto.
  const last = out[out.length - 1]
  if (last) {
    const mid = (last.xl + last.xr) / 2
    last.xl = last.xr = mid
  }
  return out
}

/**
 * Rejilla a partir de un contorno. `colors`: [base, cuerpo, punta] en espacio lineal.
 * El resultado apunta hacia +Y con la base en el origen, en el plano XY (normal +Z).
 */
function sheet(cmds: readonly Cmd[], length: number, bend: Bend, colors: readonly THREE.Color[], rows = 22, cols = 10): THREE.BufferGeometry {
  const rowsData = profile(toOutline(cmds, 16), rows, length)
  const positions: number[] = []
  const vcolors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const tmp = new THREE.Color()
  const [c0, c1, c2] = [colors[0]!, colors[1] ?? colors[0]!, colors[2] ?? colors[1] ?? colors[0]!]

  for (let r = 0; r <= rows; r++) {
    const row = rowsData[r]!
    const v = r / rows
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2 - 1 // −1 … 1 a lo ancho
      const x = row.xl + ((u + 1) / 2) * (row.xr - row.xl)
      const half = Math.max(1e-4, (row.xr - row.xl) / 2)
      const across = (x - (row.xl + row.xr) / 2) / half
      const z =
        bend.cup * length * across * across * Math.sin(Math.min(1, v * 1.4) * Math.PI * 0.5) +
        bend.curl * length * v * v +
        (bend.fold ?? 0.12) * length * Math.sqrt(across * across + 0.03) * 0.25 +
        // Borde ondulado: solo cerca del borde y más hacia la punta.
        (bend.ruffle ?? 0.25) * length * 0.04 * Math.sin(v * Math.PI * 3 + (across > 0 ? 1.3 : 0)) * Math.abs(across) ** 3 * v
      positions.push(x, row.y, z)
      uvs.push(c / cols, v)
      // Color: base profunda → cuerpo → punta clara; los bordes, un poco más claros.
      if (v < 0.45) tmp.copy(c0).lerp(c1, v / 0.45)
      else tmp.copy(c1).lerp(c2, (v - 0.45) / 0.55)
      tmp.offsetHSL(0, 0, Math.abs(across) * 0.025)
      vcolors.push(tmp.r, tmp.g, tmp.b)
    }
  }
  const stride = cols + 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c
      const b = a + 1
      const d = a + stride
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(vcolors, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Pétalo 3D a partir de la forma del generador (en unidades del SVG; se escala fuera). */
export function petalGeometry(shape: PetalShape, bend: Bend, colors: readonly THREE.Color[]): THREE.BufferGeometry {
  return sheet(petalCommands(shape), shape.length, bend, colors)
}

/** Hoja 3D con pliegue en el nervio. */
export function leafGeometry(length: number, width: number, curl: number, colors: readonly THREE.Color[]): THREE.BufferGeometry {
  return sheet(leafCommands(length, width, curl), length, { cup: 0.08, curl: -0.12, fold: 0.6 }, colors, 10, 6)
}

/** Color hexadecimal → THREE.Color en el espacio de trabajo lineal. */
export const col = (hex: string): THREE.Color => new THREE.Color(hex)

/**
 * Hoja fotográfica: una rejilla rectangular (la silueta la pone la transparencia de la foto)
 * con pliegue en el nervio y la punta arqueada. uv (0,0) = arranque del peciolo, v a lo largo.
 */
export function photoLeafGeometry(length: number, curl: number, fold = 0.18, rows = 12, cols = 8): THREE.BufferGeometry {
  const width = length * 0.65
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rows; r++) {
    const v = r / rows
    for (let c = 0; c <= cols; c++) {
      const u = c / cols
      const across = u * 2 - 1
      const x = across * width * 0.5
      const z = fold * width * Math.abs(across) * Math.sin(Math.min(1, v * 1.5) * Math.PI * 0.5) + curl * length * v * v
      positions.push(x, v * length, z)
      uvs.push(u, v)
    }
  }
  const stride = cols + 1
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = r * stride + c
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}
