import { describe, expect, it } from 'vitest'
import { GARDEN, TIMELINES, bloomTiming, budTiming, stemTiming } from '@/lib/sequence'

describe('sequence', () => {
  it('la apertura por tiempo dura entre 5 y 7 segundos', () => {
    expect(TIMELINES.garden.total).toBeGreaterThanOrEqual(5)
    expect(TIMELINES.garden.total).toBeLessThanOrEqual(7)
  })

  it('jardín: un solo momento, cada paso empieza antes de que acabe el anterior', () => {
    const steps = Object.values(GARDEN).sort((a, b) => a.start - b.start)
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1]!
      expect(steps[i]!.start).toBeLessThanOrEqual(prev.start + prev.dur + 1.9)
    }
  })

  it('con 5, 7 u 11 flores la cascada cabe en su ventana, sin escalonado negativo', () => {
    for (const tl of Object.values(TIMELINES)) {
      for (const count of [5, 7, 11]) {
        let last = -Infinity
        for (let order = 0; order < count; order++) {
          const bloom = bloomTiming(order, count, 1.25, tl)
          expect(bloom.delay).toBeGreaterThanOrEqual(last)
          last = bloom.delay
          expect(bloom.delay).toBeGreaterThanOrEqual(tl.flowers.start)
        }
      }
    }
  })

  it('jardín: cada flor abre después de que su tallo llegue arriba y su capullo aparezca', () => {
    for (const count of [5, 7, 11]) {
      for (let order = 0; order < count; order++) {
        const stem = stemTiming(order, count)
        const bud = budTiming(order, count, 1)
        const bloom = bloomTiming(order, count, 1, TIMELINES.garden)
        expect(bud.appear).toBeGreaterThan(stem.delay)
        expect(bud.burst).toBeGreaterThan(bud.appear)
        expect(bloom.delay).toBeGreaterThanOrEqual(stem.delay + stem.duration * 0.6)
      }
    }
  })
})
