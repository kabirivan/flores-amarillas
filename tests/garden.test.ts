import { describe, expect, it } from 'vitest'
import { gardenLayout } from '@/lib/three/garden/layout'

describe('jardín', () => {
  const g = gardenLayout('maría', 220, 7)

  it('es determinista', () => {
    expect(gardenLayout('maría', 220, 7)).toEqual(g)
    expect(gardenLayout('begoña', 220, 7)).not.toEqual(g)
  })

  it('las flores no se solapan y dejan libre el frente central', () => {
    const f = g.flowers
    expect(f.length).toBeGreaterThan(150)
    for (let i = 0; i < f.length; i++) {
      expect(Math.abs(f[i]!.x) < 1.6 && f[i]!.z > -1.2).toBe(false)
      for (let j = i + 1; j < f.length; j++) {
        expect(Math.hypot(f[i]!.x - f[j]!.x, f[i]!.z - f[j]!.z)).toBeGreaterThan(0.5)
      }
    }
  })

  it('hay amarillas de sobra y cada flor del ramo sale de una amarilla distinta', () => {
    expect(g.yellowCount).toBeGreaterThanOrEqual(11)
    const picked = g.flowers.filter((f) => f.bouquet >= 0)
    expect(picked.map((f) => f.bouquet).sort()).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const f of picked) expect(f.yellow).toBe(true)
  })

  it('las amarillas destacan: más altas y más grandes que el resto de media', () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const y = g.flowers.filter((f) => f.yellow)
    const o = g.flowers.filter((f) => !f.yellow)
    expect(avg(y.map((f) => f.height))).toBeGreaterThan(avg(o.map((f) => f.height)))
    expect(avg(y.map((f) => f.radius))).toBeGreaterThan(avg(o.map((f) => f.radius)))
  })
})
