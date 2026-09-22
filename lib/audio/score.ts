/**
 * La partitura: funciones puras que convierten la línea de tiempo de la apertura en notas.
 * Sin Web Audio aquí; eso vive en music.ts. Así se puede testear (y cada nombre tiene su
 * propia melodía: el PRNG sale de la misma semilla que el ramo).
 *
 * Tonalidad: Re mayor, melodía en pentatónica (re mi fa# la si), que no tiene semitonos
 * y por eso cualquier combinación suena consonante. Cadencia I → vi → IV → I.
 */

import { createRng, type Rng } from '@/lib/bouquet/prng'
import type { Timeline } from '@/lib/sequence'

export type Voice = 'bell' | 'pad' | 'sub' | 'sparkle'

export type NoteEvent = {
  /** Segundos desde el inicio de la pieza. */
  t: number
  midi: number
  /** Duración (campanas: decaimiento; colchón: sostenido). */
  dur: number
  /** Intensidad 0–1. */
  vel: number
  voice: Voice
}

/** Clases de altura de la pentatónica de Re: re, mi, fa#, la, si. */
export const PENTATONIC = [2, 4, 6, 9, 11] as const

/** Acordes (MIDI) del colchón. */
export const CHORDS = {
  I: [50, 57, 62, 66, 69], // Re mayor (añadida la 5.ª arriba)
  vi: [47, 54, 62, 66, 71], // Si menor 7
  IV: [43, 50, 59, 66, 69], // Sol maj7 (9)
  V: [45, 52, 59, 62, 67], // La sus4
} as const

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

/** Notas de la pentatónica entre dos alturas MIDI, ordenadas. */
export function pentatonicRange(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let m = lo; m <= hi; m++) if ((PENTATONIC as readonly number[]).includes(((m % 12) + 12) % 12)) out.push(m)
  return out
}

/** Momentos clave de la apertura que la música subraya. */
export type Cues = {
  /** Destello inicial (arpegio de campanitas). */
  spark: number
  /** Melodía tranquila. */
  melody: [number, number]
  /** Subida de tensión antes de la llegada (puede tener duración 0). */
  build: [number, number]
  /** Acorde de llegada con bajo profundo (fusión); null si no hay. */
  arrival: number | null
  /** Floración de cada flor, en orden de cascada. */
  blooms: number[]
  /** Aparición del texto: resolución final. */
  outro: number
  /** Fin de la pieza de apertura: desde aquí, el bucle ambiental. */
  end: number
}

export function cuesFor(tl: Timeline, blooms: number[]): Cues {
  const firstBloom = blooms[0] ?? tl.flowers.start
  return {
    spark: 0.3,
    melody: [0.7, firstBloom],
    build: [firstBloom, firstBloom],
    arrival: null,
    blooms,
    outro: tl.text.start,
    end: tl.total,
  }
}

/** Paseo melódico por la pentatónica: pasos cortos, algún salto, sin repetir demasiado. */
function walk(rng: Rng, scale: number[], from: number): number {
  const step = rng.weighted([-2, -1, 1, 2, 3], [1, 3, 3, 2, 0.6])
  return Math.max(0, Math.min(scale.length - 1, from + step))
}

/** La pieza de apertura completa. */
export function openingScore(seed: string, cues: Cues): NoteEvent[] {
  const rng = createRng(`musica:${seed}`)
  const events: NoteEvent[] = []
  const high = pentatonicRange(74, 93) // re5 – la6: caja de música

  // Colchón: I → vi → IV → I, cambiando en los momentos clave.
  const changes: [number, readonly number[]][] = [
    [0.1, CHORDS.I],
    [cues.melody[1], CHORDS.vi],
    [cues.arrival ?? cues.blooms[0] ?? cues.outro - 1.5, CHORDS.IV],
    [cues.outro, CHORDS.I],
  ]
  changes.sort((a, b) => a[0] - b[0])
  changes.forEach(([t, chord], i) => {
    const next = changes[i + 1]?.[0] ?? cues.end + 1.5
    for (const midi of chord) events.push({ t, midi, dur: next - t + 1.2, vel: 0.5, voice: 'pad' })
  })

  // Destello: arpegio ascendente rápido.
  ;[74, 78, 81, 86, 88].forEach((midi, i) => {
    events.push({ t: cues.spark + i * 0.07, midi, dur: 1.6, vel: 0.55 - i * 0.05, voice: 'sparkle' })
  })

  // Melodía tranquila, con silencios.
  let idx = rng.int(3, 6)
  for (let t = cues.melody[0]; t < cues.melody[1] - 0.2; t += rng.pick([0.42, 0.42, 0.63, 0.84])) {
    if (rng.chance(0.18)) continue
    idx = walk(rng, high, idx)
    events.push({ t, midi: high[idx] ?? 81, dur: 2.2, vel: rng.range(0.32, 0.5), voice: 'bell' })
  }

  // Subida: arpegio de acorde que asciende y se acelera.
  const [b0, b1] = cues.build
  if (b1 - b0 > 0.5) {
    const climb = pentatonicRange(62, 93)
    const span = b1 - b0
    let t = b0
    let k = 0
    while (t < b1 - 0.05) {
      const p = (t - b0) / span
      const midi = climb[Math.min(climb.length - 1, Math.floor(p * (climb.length - 1)) + (k % 3))] ?? 81
      events.push({ t, midi, dur: 1.4, vel: 0.22 + p * 0.3, voice: 'bell' })
      t += 0.3 - p * 0.16
      k++
    }
  }

  // Llegada: acorde de campanas rasgueado y un bajo profundo.
  if (cues.arrival !== null) {
    const a = cues.arrival
    events.push({ t: a, midi: 38, dur: 3.5, vel: 0.5, voice: 'sub' })
    ;[74, 78, 81, 86, 90].forEach((midi, i) => {
      events.push({ t: a + i * 0.045, midi, dur: 3, vel: 0.5, voice: 'bell' })
    })
  }

  // Una campanita por flor, cada vez un poco más aguda.
  const bloomNotes = pentatonicRange(79, 98)
  cues.blooms.forEach((t, i) => {
    const midi = bloomNotes[Math.min(bloomNotes.length - 1, i + rng.int(0, 1))] ?? 86
    events.push({ t, midi, dur: 1.8, vel: 0.3, voice: 'sparkle' })
  })

  // Resolución con el texto: un motivo corto que cae a la tónica.
  const motif = [high[rng.int(6, 8)] ?? 86, high[rng.int(4, 6)] ?? 83, 78, 74]
  motif.forEach((midi, i) => {
    events.push({ t: cues.outro + 0.2 + i * 0.36, midi, dur: i === motif.length - 1 ? 3.2 : 2, vel: 0.42, voice: 'bell' })
  })

  return events.sort((a, b) => a.t - b.t)
}

/** Duración de un compás del bucle ambiental. */
export const AMBIENT_BAR = 4.8
const AMBIENT_PROGRESSION = [CHORDS.I, CHORDS.vi, CHORDS.IV, CHORDS.V] as const

/**
 * Un compás del bucle ambiental que suena mientras se contempla el ramo. Tiempos
 * relativos al inicio del compás. Más espaciado y suave que la apertura.
 */
export function ambientBar(seed: string, bar: number): NoteEvent[] {
  const rng = createRng(`ambiente:${seed}:${bar}`)
  const chord = AMBIENT_PROGRESSION[bar % AMBIENT_PROGRESSION.length] ?? CHORDS.I
  const events: NoteEvent[] = chord.map((midi) => ({ t: 0, midi, dur: AMBIENT_BAR + 1.4, vel: 0.36, voice: 'pad' as const }))
  const high = pentatonicRange(74, 88)
  let idx = rng.int(2, 5)
  for (let t = 0.3; t < AMBIENT_BAR - 0.4; t += rng.pick([0.6, 0.9, 1.2])) {
    if (rng.chance(0.35)) continue
    idx = walk(rng, high, idx)
    events.push({ t, midi: high[idx] ?? 81, dur: 2.6, vel: rng.range(0.18, 0.3), voice: 'bell' })
  }
  return events
}

/**
 * Motivo de cada capítulo de la historia, cuando su frase llega al centro. Crece en
 * número de notas y en altura a medida que avanza la historia; el ramo trae el acorde de
 * llegada con el bajo, y el final, la resolución.
 */
export function chapterCue(seed: string, chapter: string): NoteEvent[] {
  const rng = createRng(`capitulo:${seed}:${chapter}`)
  const scale = pentatonicRange(74, 93)
  const bell = (t: number, midi: number, vel = 0.4, dur = 2.4): NoteEvent => ({ t, midi, dur, vel, voice: 'bell' })
  switch (chapter) {
    case 'semilla': // la semilla cae: una sola nota, alta
      return [bell(0, 86, 0.38, 3)]
    case 'encuentro': // dos luces: dos notas que se encuentran
      return [bell(0, 81, 0.36), bell(0.42, 78, 0.36)]
    case 'cuidar': // cuidar: un motivo de tres notas
      return [0, 0.35, 0.7].map((t, i) => bell(t, scale[rng.int(2, 6) + i] ?? 81, 0.34))
    case 'lluvia': // lluvia: notas graves y espaciadas
      return [bell(0, 69, 0.3, 3), bell(0.8, 66, 0.26, 3)]
    case 'sol': // sol: sube
      return [74, 78, 81, 86].map((midi, i) => bell(i * 0.22, midi, 0.3 + i * 0.04))
    case 'florecer': // el jardín florece: arpegio que asciende y se acelera
      return pentatonicRange(62, 93).map((midi, i) => bell(i * Math.max(0.07, 0.2 - i * 0.012), midi, 0.2 + i * 0.015, 1.6))
    case 'ramo': // el ramo: llegada
      return [
        { t: 0, midi: 38, dur: 3.5, vel: 0.5, voice: 'sub' as const },
        ...[74, 78, 81, 86, 90].map((midi, i) => bell(i * 0.045, midi, 0.5, 3)),
      ]
    case 'contemplar': // de cerca: un acorde suave y abierto, como una respiración
      return [74, 81, 86, 90].map((midi, i) => bell(i * 0.6, midi, 0.24, 3.4))
    default: // final: resolución a la tónica
      return [scale[rng.int(6, 8)] ?? 86, scale[rng.int(4, 6)] ?? 83, 78, 74].map((midi, i) => bell(0.2 + i * 0.36, midi, 0.42, i === 3 ? 3.2 : 2))
  }
}
