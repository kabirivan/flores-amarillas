/**
 * Constructores de paths SVG. Funciones puras, sin React y sin DOM: las usan por igual
 * los componentes animados, el renderizador estático para la imagen Open Graph y la
 * exportación a PNG.
 *
 * Convención: cada pieza se dibuja en su propio espacio local, con el origen en el punto
 * de unión y apuntando hacia arriba (-Y). Quien la coloca aplica la traslación y el giro.
 */

/** Redondea a 2 decimales. Mantiene los paths cortos y el SSR idéntico al cliente. */
const n = (v: number): string => {
  const r = Math.round(v * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

export type Point = { x: number; y: number }

// ---------------------------------------------------------------------------
// Pétalo
// ---------------------------------------------------------------------------

export type PetalShape = {
  /** Largo desde la base hasta la punta. */
  length: number
  /** Semiancho máximo. */
  width: number
  /** Dónde está la parte más ancha: 0 = en la base, 1 = en la punta. */
  waist: number
  /** Ancho de la base respecto al semiancho máximo (0–1). */
  base: number
  /** Redondez de la punta: 0 = lanceolada, 1 = espatulada. */
  tip: number
  /** Hendidura central en la punta (0–1). Tulipán y margarita la usan. */
  notch: number
  /**
   * Curvatura lateral, −1 a 1. La punta se desplaza hacia un lado y el resto del pétalo
   * la sigue de forma progresiva: ningún pétalo real es perfectamente simétrico.
   */
  bend?: number
}

/**
 * Un pétalo apuntando hacia arriba, con la base en el origen.
 * Se construye simétrico y después se curva: cada punto se desplaza en X en proporción
 * al cuadrado de su altura, así la base queda quieta y la punta es la que más se mueve.
 */
/** Comandos de trazo independientes del destino (cadena SVG o forma de Three.js). */
export type Cmd =
  | readonly ['M', number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['Z']

/**
 * Un pétalo apuntando hacia arriba (−Y), con la base en el origen.
 * Se construye simétrico y después se curva: cada punto se desplaza en X en proporción
 * al cuadrado de su altura, así la base queda quieta y la punta es la que más se mueve.
 * La misma lista de comandos dibuja el pétalo del SVG y el del ramo 3D.
 */
export function petalCommands(shape: PetalShape): Cmd[] {
  const { length: L, width: W, waist, base, tip, notch } = shape
  const shift = (shape.bend ?? 0) * W * 0.7
  const X = (x: number, y: number): number => {
    const t = Math.min(1, Math.max(0, -y / L))
    return x + shift * t * t
  }

  const bw = W * base
  const wy = -L * waist
  const lobe = W * tip * 0.55
  const notchY = -L + L * notch * 0.16
  const upper = wy + (-L - wy) * 0.5

  const cmds: Cmd[] = [
    ['M', X(-bw, 0), 0],
    // lado izquierdo, de la base al punto más ancho
    ['C', X(-bw * 1.15, wy * 0.4), wy * 0.4, X(-W, wy * 0.62), wy * 0.62, X(-W, wy), wy],
    // del punto más ancho a la punta
    ['C', X(-W, upper), upper, X(-lobe, -L * 0.95), -L * 0.95, X(-lobe, -L), -L],
  ]
  if (notch > 0.01) {
    // punta partida en dos lóbulos
    cmds.push(['Q', X(-lobe * 0.5, notchY), notchY, X(0, notchY), notchY])
    cmds.push(['Q', X(lobe * 0.5, notchY), notchY, X(lobe, -L), -L])
  } else {
    const apex = -L - L * tip * 0.05
    cmds.push(['Q', X(0, apex), apex, X(lobe, -L), -L])
  }
  cmds.push(
    // lado derecho, de la punta al punto más ancho
    ['C', X(lobe, -L * 0.95), -L * 0.95, X(W, upper), upper, X(W, wy), wy],
    // de vuelta a la base
    ['C', X(W, wy * 0.62), wy * 0.62, X(bw * 1.15, wy * 0.4), wy * 0.4, X(bw, 0), 0],
    ['Z'],
  )
  return cmds
}

/** Comandos → atributo `d` de SVG (con 2 decimales). */
export function toPath(cmds: readonly Cmd[]): string {
  return cmds
    .map((c) => {
      switch (c[0]) {
        case 'M':
          return `M${n(c[1])},${n(c[2])}`
        case 'C':
          return `C${n(c[1])},${n(c[2])} ${n(c[3])},${n(c[4])} ${n(c[5])},${n(c[6])}`
        case 'Q':
          return `Q${n(c[1])},${n(c[2])} ${n(c[3])},${n(c[4])}`
        case 'Z':
          return 'Z'
      }
    })
    .join('')
}

/** Comandos → contorno muestreado (para triangular en 3D). `steps` puntos por curva. */
export function toOutline(cmds: readonly Cmd[], steps = 8): [number, number][] {
  const out: [number, number][] = []
  let x = 0
  let y = 0
  for (const c of cmds) {
    if (c[0] === 'M') {
      x = c[1]
      y = c[2]
      out.push([x, y])
    } else if (c[0] === 'C') {
      const [, x1, y1, x2, y2, x3, y3] = c
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        out.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ])
      }
      x = x3
      y = y3
    } else if (c[0] === 'Q') {
      const [, x1, y1, x2, y2] = c
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const u = 1 - t
        out.push([u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2])
      }
      x = x2
      y = y2
    }
  }
  // El último punto repite el primero (el trazo se cierra): fuera.
  const first = out[0]
  const last = out[out.length - 1]
  if (first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) out.pop()
  return out
}

export function petalPath(shape: PetalShape): string {
  return toPath(petalCommands(shape))
}

/** Nervio central del pétalo: sigue la misma curvatura que el contorno. */
export function petalVeinPath(shape: PetalShape): string {
  const L = shape.length
  const shift = (shape.bend ?? 0) * shape.width * 0.7
  const at = (t: number) => `${n(shift * t * t)},${n(-L * t)}`
  return `M${at(0.08)}Q${n(shift * 0.25)},${n(-L * 0.5)} ${at(0.78)}`
}

/**
 * Sombra interior del pétalo: la misma silueta encogida y desplazada hacia la base.
 * Se pinta encima con poca opacidad para dar volumen sin usar filtros.
 */
export function petalShadePath(shape: PetalShape): string {
  return petalPath({
    ...shape,
    length: shape.length * 0.82,
    width: shape.width * 0.52,
    notch: shape.notch * 0.5,
  })
}

// ---------------------------------------------------------------------------
// Tallo
// ---------------------------------------------------------------------------

/**
 * Tallo como curva cúbica desde el punto de atado hasta la cabeza de la flor.
 * `bow` desplaza los controles perpendicularmente: positivo curva hacia la derecha.
 */
export function stemPath(bind: Point, head: Point, bow: number): string {
  const dx = head.x - bind.x
  const dy = head.y - bind.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  const c1x = bind.x + dx * 0.3 + nx * bow
  const c1y = bind.y + dy * 0.3 + ny * bow
  const c2x = bind.x + dx * 0.72 + nx * bow * 0.8
  const c2y = bind.y + dy * 0.72 + ny * bow * 0.8

  return `M${n(bind.x)},${n(bind.y)}C${n(c1x)},${n(c1y)} ${n(c2x)},${n(c2y)} ${n(head.x)},${n(head.y)}`
}

/** Punto sobre la cúbica del tallo en el parámetro t (0 = atado, 1 = cabeza). */
export function stemPointAt(bind: Point, head: Point, bow: number, t: number): Point {
  const dx = head.x - bind.x
  const dy = head.y - bind.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  const p0 = bind
  const p1 = { x: bind.x + dx * 0.3 + nx * bow, y: bind.y + dy * 0.3 + ny * bow }
  const p2 = { x: bind.x + dx * 0.72 + nx * bow * 0.8, y: bind.y + dy * 0.72 + ny * bow * 0.8 }
  const p3 = head

  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t

  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

// ---------------------------------------------------------------------------
// Hoja
// ---------------------------------------------------------------------------

/** Hoja lanceolada con la base en el origen, apuntando hacia arriba y curvada por `curl`. */
export function leafCommands(length: number, width: number, curl: number): Cmd[] {
  const tipX = curl * length * 0.35
  const tipY = -length
  return [
    ['M', 0, 0],
    ['C', -width, -length * 0.32, tipX - width * 0.45, -length * 0.78, tipX, tipY],
    ['C', tipX + width * 0.45, -length * 0.78, width, -length * 0.32, 0, 0],
    ['Z'],
  ]
}

export function leafPath(length: number, width: number, curl: number): string {
  return toPath(leafCommands(length, width, curl))
}

/** Nervio central de la hoja, para un trazo fino encima. */
export function leafVeinPath(length: number, curl: number): string {
  const tipX = curl * length * 0.35
  return `M0,0Q${n(tipX * 0.3)},${n(-length * 0.5)} ${n(tipX * 0.86)},${n(-length * 0.88)}`
}

// ---------------------------------------------------------------------------
// Papel y lazo
// ---------------------------------------------------------------------------

export type WrapShape = {
  bind: Point
  /** Semiancho de la boca del cono. */
  spread: number
  /** Cuánto baja el pico por debajo del punto de atado. */
  drop: number
  /** Cuánto sube la boca por encima del punto de atado. */
  rise: number
  /** Irregularidad del borde superior, 0–1. */
  ruffle: number
}

/** Cono de papel completo (silueta), usado para sombras y para el renderizado estático. */
export function wrapPath(shape: WrapShape): string {
  const { bind, spread, drop, rise, ruffle } = shape
  const tipY = bind.y + drop
  const topY = bind.y - rise
  const wave = rise * 0.18 * ruffle

  return [
    `M${n(bind.x)},${n(tipY)}`,
    `L${n(bind.x - spread)},${n(topY + wave)}`,
    `Q${n(bind.x - spread * 0.5)},${n(topY - wave * 1.6)} ${n(bind.x)},${n(topY + wave * 0.4)}`,
    `Q${n(bind.x + spread * 0.5)},${n(topY - wave * 1.2)} ${n(bind.x + spread)},${n(topY + wave * 0.8)}`,
    'Z',
  ].join('')
}

/**
 * Una de las dos hojas delanteras del envoltorio. Cada una sale del pico, cubre su lado
 * y pasa un poco del centro para solaparse con la otra, como un papel doblado de verdad.
 * `side` −1 = izquierda (queda debajo), 1 = derecha (queda encima).
 */
export function wrapPanelPath(shape: WrapShape, side: -1 | 1): string {
  const { bind, spread, drop, rise, ruffle } = shape
  const tipY = bind.y + drop
  const topY = bind.y - rise
  const wave = rise * 0.2 * ruffle
  const outerX = bind.x + side * spread
  // El borde interior cruza el centro: la hoja de encima llega más lejos.
  const innerX = bind.x - side * spread * (side === 1 ? 0.16 : 0.1)
  const innerY = topY + (side === 1 ? wave * 0.2 : -wave * 0.4)
  const outerY = topY + wave * (side === 1 ? 0.7 : 1)

  return [
    `M${n(bind.x)},${n(tipY)}`,
    `L${n(outerX)},${n(outerY)}`,
    // borde superior con dos ondas: el papel nunca queda recto
    `Q${n(bind.x + side * spread * 0.72)},${n(topY - wave * 1.5)} ${n(bind.x + side * spread * 0.45)},${n(topY - wave * 0.2)}`,
    `Q${n(bind.x + side * spread * 0.18)},${n(topY - wave * 1.3)} ${n(innerX)},${n(innerY)}`,
    'Z',
  ].join('')
}

/** Sombra que la hoja de encima proyecta sobre la de debajo, a lo largo de su borde. */
export function wrapOverlapShadowPath(shape: WrapShape): string {
  const { bind, spread, drop, rise, ruffle } = shape
  const tipY = bind.y + drop
  const topY = bind.y - rise
  const wave = rise * 0.2 * ruffle
  const edgeX = bind.x - spread * 0.16
  const edgeY = topY + wave * 0.2
  return `M${n(bind.x)},${n(tipY)}L${n(edgeX)},${n(edgeY)}L${n(edgeX - spread * 0.2)},${n(edgeY + wave * 0.6)}Z`
}

/** Hoja interior (papel de seda), más alta y con el borde festoneado. Queda detrás de los tallos. */
export function wrapInnerPath(shape: WrapShape, scallops: number): string {
  const { bind, spread, drop, rise } = shape
  const w = spread * 1.02
  const tipY = bind.y + drop * 0.9
  const topY = bind.y - rise * 1.3
  const parts = [`M${n(bind.x)},${n(tipY)}`, `L${n(bind.x - w)},${n(topY + rise * 0.12)}`]
  const step = (w * 2) / scallops
  for (let i = 0; i < scallops; i++) {
    const x0 = bind.x - w + step * i
    const x1 = x0 + step
    // arco del festón: sube en el centro de cada tramo; los del centro son más altos
    const mid = 1 - Math.abs(i + 0.5 - scallops / 2) / (scallops / 2)
    const peak = topY - rise * (0.1 + mid * 0.22)
    const endY = topY + rise * 0.12 * (1 - mid) - rise * 0.06
    parts.push(`Q${n((x0 + x1) / 2)},${n(peak)} ${n(x1)},${n(endY)}`)
  }
  parts.push('Z')
  return parts.join('')
}

/** Pliegue del papel: una línea desde el pico hacia un punto de la boca. */
export function wrapFoldPath(shape: WrapShape, t: number): string {
  const { bind, spread, drop, rise } = shape
  const tipY = bind.y + drop
  const topY = bind.y - rise
  const x = bind.x - spread + spread * 2 * t
  return `M${n(bind.x)},${n(tipY)}L${n(x)},${n(topY + rise * 0.06)}`
}

/** Lazada: dos bucles simétricos con la unión en el origen. */
export function bowPath(size: number, lean: number): string {
  const w = size
  const h = size * 0.72
  const k = lean * size * 0.12
  return [
    'M0,0',
    `C${n(-w * 0.35)},${n(-h * 0.85)} ${n(-w * 1.05 + k)},${n(-h * 0.6)} ${n(-w * 0.98 + k)},${n(-h * 0.05)}`,
    `C${n(-w * 0.92 + k)},${n(h * 0.5)} ${n(-w * 0.3)},${n(h * 0.2)} 0,0`,
    `C${n(w * 0.35)},${n(-h * 0.85)} ${n(w * 1.05 + k)},${n(-h * 0.6)} ${n(w * 0.98 + k)},${n(-h * 0.05)}`,
    `C${n(w * 0.92 + k)},${n(h * 0.5)} ${n(w * 0.3)},${n(h * 0.2)} 0,0`,
    'Z',
  ].join('')
}

/** Las dos colas del lazo, colgando. */
export function ribbonTailsPath(size: number, lean: number): string {
  const w = size
  const h = size * 1.5
  const k = lean * size * 0.1
  return [
    'M0,0',
    `C${n(-w * 0.2)},${n(h * 0.4)} ${n(-w * 0.62 + k)},${n(h * 0.62)} ${n(-w * 0.5 + k)},${n(h)}`,
    `L${n(-w * 0.16 + k)},${n(h * 0.9)}`,
    `C${n(-w * 0.26)},${n(h * 0.5)} ${n(-w * 0.04)},${n(h * 0.28)} 0,0`,
    'Z',
    'M0,0',
    `C${n(w * 0.22)},${n(h * 0.34)} ${n(w * 0.58 + k)},${n(h * 0.58)} ${n(w * 0.46 + k)},${n(h * 0.92)}`,
    `L${n(w * 0.12 + k)},${n(h * 0.82)}`,
    `C${n(w * 0.22)},${n(h * 0.46)} ${n(w * 0.04)},${n(h * 0.26)} 0,0`,
    'Z',
  ].join('')
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** `translate(x,y) rotate(deg) scale(s)` en un solo atributo. */
export function place(x: number, y: number, rotation = 0, scale = 1): string {
  const parts = [`translate(${n(x)},${n(y)})`]
  if (rotation !== 0) parts.push(`rotate(${n(rotation)})`)
  if (scale !== 1) parts.push(`scale(${n(scale)})`)
  return parts.join(' ')
}

export const round2 = n
