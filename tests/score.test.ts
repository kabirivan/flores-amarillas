import { describe, expect, it } from 'vitest'
import { PENTATONIC, ambientBar, cuesFor, openingScore } from '@/lib/audio/score'
import { TIMELINES } from '@/lib/sequence'

const blooms = [1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0]
const score = (seed: string) => openingScore(seed, cuesFor(TIMELINES.garden, blooms))

describe('partitura', () => {
  it('misma semilla, misma música; otra semilla, otra melodía', () => {
    expect(score('maría')).toEqual(score('maría'))
    const melody = (s: string) => score(s).filter((e) => e.voice === 'bell').map((e) => e.midi).join()
    expect(melody('maría')).not.toBe(melody('begoña'))
  })

  it('la melodía y las campanitas están en la pentatónica de Re', () => {
    for (const e of score('maría')) {
      if (e.voice === 'bell' || e.voice === 'sparkle') {
        expect(PENTATONIC as readonly number[]).toContain(((e.midi % 12) + 12) % 12)
      }
    }
  })

  it('suena dentro de la apertura, ordenada y sin valores raros', () => {
    const events = score('maría')
    let last = -Infinity
    for (const e of events) {
      expect(e.t).toBeGreaterThanOrEqual(last)
      last = e.t
      expect(e.t).toBeGreaterThanOrEqual(0)
      expect(e.t).toBeLessThanOrEqual(TIMELINES.garden.total)
      expect(e.dur).toBeGreaterThan(0)
      expect(e.vel).toBeGreaterThan(0)
      expect(e.vel).toBeLessThanOrEqual(1)
    }
  })

  it('hay una campanita por flor', () => {
    const events = score('maría')
    for (const t of blooms) expect(events.some((e) => e.voice === 'sparkle' && e.t === t)).toBe(true)
  })

  it('el bucle ambiental es determinista y cabe en su compás', () => {
    expect(ambientBar('maría', 3)).toEqual(ambientBar('maría', 3))
    for (const e of ambientBar('maría', 2)) expect(e.t).toBeLessThan(4.8)
  })
})

import { chapterCue } from '@/lib/audio/score'
import { CHAPTERS } from '@/lib/three/timeline'

describe('motivos de capítulo', () => {
  it('cada capítulo tiene su motivo, determinista y en la pentatónica', () => {
    for (const { id } of CHAPTERS) {
      const cue = chapterCue('maría', id)
      expect(cue.length).toBeGreaterThan(0)
      expect(chapterCue('maría', id)).toEqual(cue)
      for (const e of cue) {
        if (e.voice === 'bell') expect(PENTATONIC as readonly number[]).toContain(e.midi % 12)
        expect(e.t).toBeGreaterThanOrEqual(0)
        expect(e.t).toBeLessThan(4)
      }
    }
  })
})
