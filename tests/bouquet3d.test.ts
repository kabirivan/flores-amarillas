import { describe, expect, it } from 'vitest'
import { generateBouquet } from '@/lib/bouquet'
import { BOUQUET_SCALE, buildBouquet3D } from '@/lib/three/bouquet3d/build'
import { GROUND } from '@/lib/three/particles/shapes'

describe('ramo 3D', () => {
  const b3 = buildBouquet3D(generateBouquet('María'))

  it('el muestreo cubre flores y papel, sin NaN', () => {
    const { pos } = b3.sample(6000, 'maría')
    let low = 0
    let high = 0
    for (let i = 0; i < 6000; i++) {
      const y = pos[i * 4 + 1]!
      expect(Number.isFinite(y)).toBe(true)
      if (y < GROUND + 2.4 * BOUQUET_SCALE) low++
      else high++
    }
    console.info(`muestreo: ${low} puntos en la zona del papel, ${high} en las flores`)
    expect(low).toBeGreaterThan(600) // el papel se tiene que leer
    expect(high).toBeGreaterThan(2400) // y las flores, más
  })

  it('es determinista', () => {
    const a = b3.sample(500, 'maría').pos
    const b = buildBouquet3D(generateBouquet('María')).sample(500, 'maría').pos
    expect(Array.from(a)).toEqual(Array.from(b))
  })
})

describe('ramo 3D por flores', () => {
  const b3 = buildBouquet3D(generateBouquet('María'))
  it('cada flor tiene sus propios puntos de aterrizaje, sobre el ramo', () => {
    for (let k = 0; k < b3.count; k++) {
      const { pos } = b3.sampleFlower(k, 200, 'maría')
      for (let i = 0; i < 200; i++) {
        expect(pos[i * 4 + 1]!).toBeGreaterThan(GROUND - 0.1)
        expect(pos[i * 4 + 1]!).toBeLessThan(GROUND + 7 * BOUQUET_SCALE + 0.5)
      }
    }
  })
})
