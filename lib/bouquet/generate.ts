/**
 * generateBouquet(seed) → Bouquet
 *
 * Función pura: sin React, sin DOM, sin Date ni Math.random. La misma semilla produce el
 * mismo objeto en el servidor, en el navegador y en la imagen Open Graph.
 *
 * El orden en que se consume el PRNG forma parte del contrato: cambiarlo cambia todos
 * los ramos ya enviados. Los tests lo fijan con un snapshot.
 */

import { createRng, cyrb128, type Rng } from './prng'
import { GREENS, PAPERS, RIBBONS, TISSUES } from './palette'
import { SPECIES, SPECIES_LIST, buildHead, toneFor, type HeadLayout, type Species } from './species'
import { stemPath, stemPointAt, type Point } from './geometry'
import type { Bouquet, Box, Flower, Leaf, Wrap } from './types'
import { graphemeLength, seedFromName } from '../link/sanitize'

export const CANVAS = { width: 600, height: 800 } as const
/** Aumento general de las cabezas respecto a las medidas de species.ts. */
const HEAD_BOOST = 1.22
export const BIND: Point = { x: 300, y: 540 }
/** Un ramo frondoso: entre 12 y 21 flores según el largo del nombre. */
export const MIN_FLOWERS = 12
export const MAX_FLOWERS = 21

const r2 = (v: number): number => Math.round(v * 100) / 100
const DEG = Math.PI / 180

/** Número de flores: crece con el largo del nombre, con un pequeño empujón del PRNG. */
export function flowerCount(name: string, rng: Rng): number {
  const len = graphemeLength(name.replace(/\s+/g, ''))
  const base = MIN_FLOWERS + Math.floor(Math.max(0, len - 2) / 1.4)
  const n = base + rng.int(-1, 1)
  return Math.max(MIN_FLOWERS, Math.min(MAX_FLOWERS, n))
}

/** Reparte especies por peso, sin que una sola acapare el ramo y con al menos dos distintas. */
function pickSpecies(rng: Rng, count: number): Species[] {
  const weights = SPECIES_LIST.map((s) => SPECIES[s].weight)
  const cap = Math.ceil(count / 2)
  const tally = new Map<Species, number>()
  const out: Species[] = []

  while (out.length < count) {
    const s = rng.weighted(SPECIES_LIST, weights)
    const used = tally.get(s) ?? 0
    if (used >= cap) continue
    tally.set(s, used + 1)
    out.push(s)
  }

  if (tally.size === 1) {
    const only = out[0] as Species
    const others = SPECIES_LIST.filter((s) => s !== only)
    out[out.length - 1] = rng.pick(others)
  }

  return out
}

/**
 * `options.species`: ramo de catálogo con especies y cantidad fijas, en ese orden. Sin opciones, el contrato de siempre: el nombre decide el ramo.
 */
export function generateBouquet(name: string, options: { species?: readonly Species[] } = {}): Bouquet {
  const seed = seedFromName(name)
  const rng = createRng(`ramo:${seed}`)

  const fixed = options.species
  const count = fixed ? fixed.length : flowerCount(seed, rng)
  // Con especies fijas se respeta el orden (quien llama ya las mezcla y necesita saber cuál es cuál).
  const species = fixed ? [...fixed] : rng.shuffle(pickSpecies(rng, count))

  // Abanico: cuantas más flores, más abierto.
  const spread = 22 + count * 1.4
  const slots = Array.from({ length: count }, (_, i) =>
    count === 1 ? 0 : -spread + (2 * spread * i) / (count - 1),
  )

  const flowers: Flower[] = species.map((sp, i) => {
    const info = SPECIES[sp]
    const lean = r2((slots[i] ?? 0) + rng.gauss(0, 3))
    const centrality = 1 - Math.abs(lean) / (spread + 6)
    const length = r2(rng.range(info.stem[0], info.stem[1]) * (0.9 + centrality * 0.2))
    const scale = r2(rng.range(info.scale[0], info.scale[1]) * HEAD_BOOST)
    const tone = toneFor(sp, rng)

    const head: Point = {
      x: r2(BIND.x + Math.sin(lean * DEG) * length),
      y: r2(BIND.y - Math.cos(lean * DEG) * length),
    }
    // Los tallos se arquean hacia fuera, como cuando un ramo se abre.
    const bow = r2(rng.gauss(0, 9) - Math.sign(lean) * rng.range(4, 14))

    const leafCount = rng.int(info.leaves[0], info.leaves[1])
    const leaves: Leaf[] = []
    for (let k = 0; k < leafCount; k++) {
      const t = r2(rng.range(0.4, 0.66) - k * 0.06)
      const side: -1 | 1 = (k + i) % 2 === 0 ? 1 : -1
      const at = stemPointAt(BIND, head, bow, t)
      leaves.push({
        t,
        at: { x: r2(at.x), y: r2(at.y) },
        side,
        length: r2(rng.range(34, 52)),
        width: r2(rng.range(8.5, 12.5)),
        angle: r2(lean + side * rng.range(30, 54)),
        curl: r2(side * rng.range(0.2, 0.7)),
        color: rng.chance(0.5) ? GREENS.mid : GREENS.light,
      })
    }

    const layout = buildHead(sp, rng)
    const spin =
      layout.kind === 'rosette' ? r2(rng.range(-20, 20)) : r2(lean * 0.55 + rng.gauss(0, 4))
    // Los tallos largos se mecen algo más; cada flor con su propio periodo.
    const sway = {
      duration: r2(rng.range(4.2, 6.8)),
      amplitude: r2(rng.range(0.7, 1.4) * (length / 280)),
      phase: r2(rng.next()),
    }

    return {
      id: `f${i}`,
      species: sp,
      order: 0,
      layer: 0,
      scale,
      spin,
      tone,
      head,
      stem: {
        length,
        lean,
        bow,
        width: r2(rng.range(3.2, 4.4) * (sp === 'sunflower' ? 1.2 : 1)),
        color: rng.chance(0.6) ? GREENS.mid : GREENS.deep,
        d: stemPath(BIND, head, bow),
      },
      leaves,
      layout,
      reach: r2(headReach(layout) * scale),
      sway,
    }
  })

  // Pintado: los tallos más altos (el centro) quedan al fondo.
  const byDepth = flowers.slice().sort((a, b) => a.head.y - b.head.y)
  byDepth.forEach((f, i) => {
    f.layer = i
  })

  // Floración: del centro hacia fuera, con un poco de desorden.
  const byBloom = flowers
    .map((f) => ({ f, key: Math.abs(f.stem.lean) + rng.range(0, 8) }))
    .sort((a, b) => a.key - b.key)
  byBloom.forEach(({ f }, i) => {
    f.order = i
  })

  const paper = rng.pick(PAPERS)
  const tissue = rng.pick(TISSUES)
  const ribbon = rng.pick(RIBBONS)
  const foldCount = rng.int(3, 5)

  const tally = Object.fromEntries(SPECIES_LIST.map((s) => [s, 0])) as Record<Species, number>
  for (const f of flowers) tally[f.species]++

  const [, h2] = cyrb128(`serie:${seed}`)

  const wrap: Wrap = {
      paper,
      tissue,
      ribbon,
      scallops: rng.int(5, 7),
      shape: {
        bind: BIND,
        spread: r2(78 + count * 4.5 + rng.range(-5, 5)),
        drop: r2(rng.range(140, 156)),
        rise: r2(rng.range(64, 76)),
        ruffle: r2(rng.range(0.4, 1)),
      },
      folds: Array.from({ length: foldCount }, (_, i) =>
        r2((i + 1) / (foldCount + 1) + rng.range(-0.05, 0.05)),
      ),
      bowLean: r2(rng.range(-1, 1)),
      bowSize: r2(rng.range(42, 50)),
  }

  return {
    seed,
    serial: 1000 + (h2 % 9000),
    flowers: byDepth,
    wrap,
    tally,
    bind: BIND,
    width: CANVAS.width,
    height: CANVAS.height,
    view: bounds(byDepth, wrap),
  }
}

/** Distancia máxima que alcanza el dibujo de una cabeza desde su centro (sin escala). */
function headReach(layout: HeadLayout): number {
  switch (layout.kind) {
    case 'rosette':
      return Math.max(...layout.petals.map((p) => p.radius + p.shape.length))
    case 'cup':
      return Math.max(...[...layout.back, ...layout.front].map((p) => p.shape.length)) + 4
    case 'spike':
      return Math.max(...layout.bells.map((b) => Math.hypot(b.x, b.y) + 24 * b.scale))
    case 'pompons':
      return Math.max(...layout.florets.map((f) => Math.hypot(f.x, f.y) + f.r + 2))
  }
}

/**
 * Caja que ocupa el ramo: cabezas (círculo de alcance), hojas, papel y lazo. Centrada en
 * el eje del atado para que el ramo no se descuadre, con un margen para el halo.
 */
function bounds(flowers: Flower[], wrap: Wrap): Box {
  const { bind, spread, drop } = wrap.shape
  let minX = bind.x - spread * 1.05
  let maxX = bind.x + spread * 1.05
  let minY = bind.y
  const bowY = bind.y + drop * 0.46
  let maxY = Math.max(bind.y + drop, bowY + 5 + wrap.bowSize * 1.5)

  for (const f of flowers) {
    minX = Math.min(minX, f.head.x - f.reach)
    maxX = Math.max(maxX, f.head.x + f.reach)
    minY = Math.min(minY, f.head.y - f.reach)
    for (const l of f.leaves) {
      minX = Math.min(minX, l.at.x - l.length)
      maxX = Math.max(maxX, l.at.x + l.length)
      minY = Math.min(minY, l.at.y - l.length)
    }
  }

  const pad = 14
  const half = Math.max(bind.x - minX, maxX - bind.x) + pad
  return {
    x: r2(bind.x - half),
    y: r2(minY - pad),
    width: r2(half * 2),
    height: r2(maxY + pad - (minY - pad)),
  }
}

/** "7 flores amarillas: dos girasoles, tres margaritas y dos ramas de mimosa". */
export function describeBouquet(b: Bouquet): string {
  const words = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once']
  const feminine = new Set<Species>(['daisy', 'freesia', 'mimosa'])
  const parts = SPECIES_LIST.filter((s) => b.tally[s] > 0).map((s) => {
    const n = b.tally[s]
    const info = SPECIES[s]
    const num = n === 1 ? (feminine.has(s) ? 'una' : 'un') : (words[n] ?? String(n))
    return `${num} ${n === 1 ? info.one : info.many}`
  })
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? '')
  return `${b.flowers.length} flores amarillas: ${list}, envueltas en papel ${b.wrap.paper.name} con lazo ${b.wrap.ribbon.name}`
}
