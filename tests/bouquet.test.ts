import { describe, expect, it } from 'vitest'
import { generateBouquet, MAX_FLOWERS, MIN_FLOWERS, describeBouquet } from '@/lib/bouquet'
import { createRng, cyrb128 } from '@/lib/bouquet/prng'
import { YELLOWS } from '@/lib/bouquet/palette'

describe('prng', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = createRng('María')
    const b = createRng('María')
    const seqA = Array.from({ length: 50 }, () => a.next())
    const seqB = Array.from({ length: 50 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('semillas distintas divergen', () => {
    expect(cyrb128('maria')).not.toEqual(cyrb128('maría'))
    expect(createRng('a').next()).not.toBe(createRng('b').next())
  })

  it('int respeta los límites inclusivos', () => {
    const rng = createRng('límites')
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(5, 11)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(11)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('generateBouquet', () => {
  it('misma semilla = mismo ramo (profundo)', () => {
    expect(generateBouquet('María')).toEqual(generateBouquet('María'))
  })

  it('normaliza mayúsculas y espacios: mismo ramo', () => {
    const a = generateBouquet('María')
    expect(generateBouquet('  maría ')).toEqual(a)
    expect(generateBouquet('MARÍA')).toEqual(a)
    // NFD (a + tilde combinante) cae en el mismo ramo que NFC
    expect(generateBouquet('María')).toEqual(a)
  })

  it('la tilde cuenta: "Maria" y "María" son ramos distintos', () => {
    expect(generateBouquet('Maria').serial).not.toBe(generateBouquet('María').serial)
  })

  it('fija el contrato: el ramo de María no cambia entre versiones', () => {
    const b = generateBouquet('María')
    expect({
      serial: b.serial,
      count: b.flowers.length,
      species: b.flowers.map((f) => f.species),
      paper: b.wrap.paper.name,
    }).toMatchSnapshot()
  })

  it('el número de flores siempre está entre 12 y 21 y crece con el nombre', () => {
    const names = ['Lu', 'Ana', 'Sofía', 'Valentina', 'José Antonio', 'María de los Ángeles Fernández']
    const counts = names.map((n) => generateBouquet(n).flowers.length)
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(MIN_FLOWERS)
      expect(c).toBeLessThanOrEqual(MAX_FLOWERS)
    }
    expect(counts[0]!).toBeLessThan(counts.at(-1)!)
  })

  it('500 nombres: sin excepciones, colores de la rampa, al menos dos especies, ramos distintos', () => {
    const rng = createRng('nombres-de-prueba')
    const letters = 'abcdefghijklmnñopqrstuvwxyzáéíóúü '
    const serialsAndShapes = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const len = rng.int(1, 40)
      let name = `n${i}`
      for (let k = 0; k < len; k++) name += letters[rng.int(0, letters.length - 1)]
      const b = generateBouquet(name)

      expect(b.flowers.length).toBeGreaterThanOrEqual(MIN_FLOWERS)
      expect(b.flowers.length).toBeLessThanOrEqual(MAX_FLOWERS)
      expect(new Set(b.flowers.map((f) => f.species)).size).toBeGreaterThanOrEqual(2)
      for (const f of b.flowers) {
        expect(YELLOWS).toContain(f.tone.base)
        expect(f.head.y).toBeGreaterThan(0)
        expect(f.head.x).toBeGreaterThan(0)
        expect(f.head.x).toBeLessThan(b.width)
        expect(f.stem.d).not.toMatch(/NaN/)
        // el encuadre ajustado contiene la cabeza entera
        expect(f.head.x - f.reach).toBeGreaterThanOrEqual(b.view.x)
        expect(f.head.x + f.reach).toBeLessThanOrEqual(b.view.x + b.view.width)
        expect(f.head.y - f.reach).toBeGreaterThanOrEqual(b.view.y)
      }
      // y el pico del papel
      expect(b.bind.y + b.wrap.shape.drop).toBeLessThanOrEqual(b.view.y + b.view.height)
      const orders = b.flowers.map((f) => f.order).sort((x, y) => x - y)
      expect(orders).toEqual(b.flowers.map((_, k) => k))
      serialsAndShapes.add(`${b.serial}:${b.flowers.map((f) => f.species + f.stem.lean).join()}`)
    }
    expect(serialsAndShapes.size).toBe(500)
  })

  it('describe el ramo en castellano', () => {
    const text = describeBouquet(generateBouquet('María'))
    expect(text).toMatch(/^\d+ flores amarillas: /)
    expect(text).toMatch(/envueltas en papel \w+ con lazo \w+$/)
  })
})
