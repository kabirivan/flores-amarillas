import { describe, expect, it } from 'vitest'
import { CLOSING, plain, storyFor } from '@/components/story/story'
import { CHAPTERS, CHAPTER_STARTS, SHAPES, flowerRevealFor, liftFor, sceneAt, wrapFor } from '@/lib/three/timeline'

describe('historia', () => {
  it('la semilla lleva el nombre de quien recibe, marcado como nombre', () => {
    const encuentro = storyFor('María').find((c) => c.id === 'encuentro')!
    expect(plain(encuentro)).toBe('Llevaba un nombre escondido: María.')
    expect(encuentro.line.filter((s) => s.name).map((s) => s.text)).toEqual(['María'])
  })

  it('quien envía no aparece en la historia (firma solo al final)', () => {
    for (const c of storyFor('María')) expect(plain(c)).not.toMatch(/encontr/)
  })

  it('una frase por capítulo con escena; contemplación y final van sin frase', () => {
    const story = storyFor('Ana')
    expect(story.map((c) => c.id)).toEqual(CHAPTERS.filter((c) => c.id !== 'final' && c.id !== 'contemplar').map((c) => c.id))
    expect(CLOSING).toMatch(/21 de septiembre/)
  })
})

describe('timeline del scroll', () => {
  it('los capítulos empiezan en orden y cubren 0–1', () => {
    expect(CHAPTER_STARTS[0]).toBe(0)
    for (let i = 1; i < CHAPTER_STARTS.length; i++) expect(CHAPTER_STARTS[i]!).toBeGreaterThan(CHAPTER_STARTS[i - 1]!)
    expect(CHAPTER_STARTS.at(-1)!).toBeLessThan(1)
  })

  it('es continuo: sin saltos de capítulo ni valores fuera de rango', () => {
    let last = sceneAt(0)
    for (let p = 0; p <= 1.0001; p += 0.002) {
      const s = sceneAt(p)
      expect(s.chapter).toBeGreaterThanOrEqual(last.chapter)
      expect(s.chapter - last.chapter).toBeLessThanOrEqual(1)
      for (const v of [s.mix, s.local, s.turbulence]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      expect(Number.isFinite(s.camera.z)).toBe(true)
      last = s
    }
  })

  it('al entrar en un capítulo sale de la forma anterior y llega a la suya', () => {
    for (let i = 1; i < CHAPTERS.length; i++) {
      const start = CHAPTER_STARTS[i]!
      const s = sceneAt(start + 1e-6)
      expect(SHAPES[s.from]).toBe(CHAPTERS[i - 1]!.shape)
      expect(SHAPES[s.to]).toBe(CHAPTERS[i]!.shape)
      // Si la forma cambia, la transición empieza desde cero (el final repite el ramo).
      if (s.from !== s.to) expect(s.mix).toBeLessThan(0.05)
    }
  })

  it('el recorrido solo existe en la contemplación y va de 0 a 1', () => {
    const c = CHAPTERS.findIndex((ch) => ch.id === 'contemplar')
    expect(sceneAt(CHAPTER_STARTS[c]! + 1e-4).tour).toBeCloseTo(0, 2)
    expect(sceneAt(CHAPTER_STARTS[c + 1]! - 1e-4).tour).toBeCloseTo(1, 2)
    expect(sceneAt(CHAPTER_STARTS[c - 1]! + 0.01).tour).toBeNull()
  })

  it('el ramo se forma en su capítulo y queda formado después', () => {
    const r = CHAPTERS.findIndex((ch) => ch.id === 'ramo')
    expect(sceneAt(CHAPTER_STARTS[r]! - 0.01).assemble).toBeNull()
    expect(sceneAt(CHAPTER_STARTS[r]! + 1e-4).assemble).toBeCloseTo(0, 2)
    expect(sceneAt(1).assemble).toBe(1)
  })

  it('el ramo se hace real al empezar la contemplación y sigue real al final', () => {
    const c = CHAPTERS.findIndex((ch) => ch.id === 'contemplar')
    expect(sceneAt(CHAPTER_STARTS[c]! - 0.01).real).toBe(0)
    expect(sceneAt(CHAPTER_STARTS[c]! + 0.001).real).toBeLessThan(0.1)
    expect(sceneAt(CHAPTER_STARTS[c + 1]! - 0.01).real).toBe(1)
    expect(sceneAt(1).real).toBe(1)
  })

  it('llueve con más viento', () => {
    const lluvia = CHAPTERS.findIndex((ch) => ch.id === 'lluvia')
    expect(sceneAt(CHAPTER_STARTS[lluvia]! + 0.05).wind).toBeGreaterThan(sceneAt(0.01).wind * 3)
  })
})

describe('el ramo flor a flor', () => {
  it('las flores salen una a una, en orden, y todas llegan antes de cerrar el papel', () => {
    for (const count of [5, 7, 11]) {
      let prevStart = -1
      for (let order = 0; order < count; order++) {
        // Primer instante en que la flor despega.
        let start = 0
        while (liftFor(start, order, count) === 0 && start < 1) start += 0.005
        expect(start).toBeGreaterThan(prevStart)
        prevStart = start
        expect(liftFor(0.84, order, count)).toBe(1) // aterrizada cuando empieza el papel
      }
      expect(wrapFor(0.8)).toBe(0)
      expect(wrapFor(1)).toBe(1)
    }
  })

  it('la flor 3D solo aparece al aterrizar su cometa, y hacia atrás se deshace', () => {
    expect(flowerRevealFor(0.5)).toBe(0)
    expect(flowerRevealFor(1)).toBe(1)
    const a = liftFor(0.3, 2, 7)
    expect(liftFor(0.2, 2, 7)).toBeLessThanOrEqual(a)
  })
})
