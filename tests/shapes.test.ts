import { describe, expect, it } from 'vitest'
import { MOTION, STATES, blocksFor, bouquetMembership, gardenShape } from '@/lib/three/particles/shapes'
import { gardenLayout } from '@/lib/three/garden/layout'

describe('jardín de luz', () => {
  const N = 6000
  const layout = gardenLayout('maría', 120, 7)
  const shape = (s: (typeof STATES)[number]) => gardenShape(s, N, layout, 'maría')

  it('es determinista por semilla', () => {
    expect(Array.from(shape('bloom').pos)).toEqual(Array.from(gardenShape('bloom', N, layout, 'maría').pos))
  })

  it('rellena los N puntos en todos los estados, sin NaN, con tamaños positivos', () => {
    for (const s of STATES) {
      const { pos, col } = shape(s)
      for (const v of pos) expect(Number.isFinite(v)).toBe(true)
      for (let i = 3; i < col.length; i += 4) expect(col[i]!).toBeGreaterThan(0)
    }
  })

  it('el césped no se mueve entre capítulos (cada partícula se transforma en su sitio)', () => {
    const [a, b] = blocksFor(N, layout).grass
    const x = (s: (typeof STATES)[number]) => Array.from(shape(s).pos.subarray(a * 4, b * 4)).filter((_, i) => i % 4 !== 3)
    expect(x('night')).toEqual(x('bloom'))
  })

  it('llueve en la lluvia y suben motas al amanecer', () => {
    const motions = (s: (typeof STATES)[number]) => new Set(Array.from(shape(s).pos.filter((_, i) => i % 4 === 3)))
    expect(motions('rain').has(MOTION.rain)).toBe(true)
    expect(motions('dawn').has(MOTION.rise)).toBe(true)
  })

  it('las amarillas brillan más que el resto al florecer', () => {
    const { col } = shape('bloom')
    const blocks = blocksFor(N, layout)
    const lum = (yellow: boolean) => {
      let sum = 0
      let n = 0
      layout.flowers.forEach((f, i) => {
        if (f.yellow !== yellow) return
        const b = blocks.flowers[i]!
        for (let k = b.start; k < b.start + b.count; k++) {
          sum += col[k * 4]! + col[k * 4 + 1]! + col[k * 4 + 2]!
          n++
        }
      })
      return sum / n
    }
    expect(lum(true)).toBeGreaterThan(lum(false) * 1.5)
  })

  it('cada flor del ramo tiene sus partículas marcadas', () => {
    const m = bouquetMembership(N, layout)
    for (let k = 0; k < 7; k++) expect(m.includes(k)).toBe(true)
    expect(m.includes(7)).toBe(false)
  })
})
