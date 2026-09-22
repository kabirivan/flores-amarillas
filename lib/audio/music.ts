/**
 * Motor de sonido: sintetiza la partitura con Web Audio, sin archivos. Solo navegador.
 *
 * Cadena: voces → bus de la reproducción → (seco + envío a reverb) → volumen general →
 * compresor suave → salida. Cada reproducción tiene su propio bus: para cortar una pieza
 * basta con apagar su bus, aunque queden notas programadas.
 *
 * Los navegadores solo dejan sonar audio tras un gesto: `unlock()` debe llamarse dentro
 * del manejador del clic en «Abrir», de forma síncrona.
 */

import { AMBIENT_BAR, ambientBar, midiToHz, type NoteEvent } from './score'

export type MusicEngine = {
  unlock: () => void
  /** Suena la apertura y, al acabar, el bucle ambiental. */
  play: (events: NoteEvent[], seed: string, ambientFrom: number) => void
  stop: () => void
  /** Suena ya, sobre la reproducción en curso (motivos de capítulo). */
  cue: (events: NoteEvent[]) => void
  /** Lluvia suave: ruido filtrado, 0 = apagada. */
  setRain: (level: number) => void
  setMuted: (muted: boolean) => void
  suspend: () => void
  resume: () => void
  dispose: () => void
}

const MASTER = 0.55
const LOOKAHEAD = 1.2 // s: cuánto por delante se programa el bucle ambiental

/** Respuesta al impulso sintética: ruido estéreo con caída exponencial (sala amplia). */
function impulse(ctx: AudioContext, seconds = 3.4, decay = 2.8): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buf.getChannelData(c)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay
  }
  return buf
}

export function createMusic(): MusicEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let reverb: ConvolverNode | null = null
  let bus: GainNode | null = null
  let muted = false
  let timer: number | null = null
  let rain: GainNode | null = null

  function ensure(): AudioContext | null {
    if (ctx) return ctx
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC({ latencyHint: 'playback' })
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    comp.connect(ctx.destination)
    master = ctx.createGain()
    master.gain.value = muted ? 0 : MASTER
    master.connect(comp)
    reverb = ctx.createConvolver()
    reverb.buffer = impulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = 0.5
    reverb.connect(wet).connect(master)
    return ctx
  }

  // ---- Instrumentos -------------------------------------------------------

  /** Caja de música: fundamental + octava + un parcial inarmónico, ataque seco y caída larga. */
  function bell(c: AudioContext, out: AudioNode, send: AudioNode, ev: NoteEvent, t: number, bright = false) {
    const f = midiToHz(ev.midi)
    const g = c.createGain()
    const peak = ev.vel * (bright ? 0.14 : 0.2)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ev.dur)
    g.connect(out)
    g.connect(send)
    const partials: [number, number][] = bright ? [[1, 1], [2, 0.3], [4.2, 0.08]] : [[1, 1], [2, 0.38], [3.01, 0.12]]
    for (const [ratio, amp] of partials) {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * ratio
      o.detune.value = (Math.random() - 0.5) * 6
      const pg = c.createGain()
      pg.gain.value = amp
      o.connect(pg).connect(g)
      o.start(t)
      o.stop(t + ev.dur + 0.05)
    }
  }

  /** Colchón: dos triangulares desafinadas, filtradas, con ataque y cola lentos. */
  function pad(c: AudioContext, out: AudioNode, send: AudioNode, ev: NoteEvent, t: number) {
    const f = midiToHz(ev.midi)
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1100
    filter.Q.value = 0.4
    const g = c.createGain()
    const level = ev.vel * 0.035
    const attack = Math.min(1.6, ev.dur * 0.4)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(level, t + attack)
    g.gain.setValueAtTime(level, t + Math.max(attack, ev.dur - 1.2))
    g.gain.linearRampToValueAtTime(0, t + ev.dur + 1.2)
    filter.connect(g)
    g.connect(out)
    g.connect(send)
    for (const cents of [-7, 7]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = cents
      o.connect(filter)
      o.start(t)
      o.stop(t + ev.dur + 1.3)
    }
  }

  /** Bajo profundo de la llegada: una senoidal que cae un poco de afinación. */
  function sub(c: AudioContext, out: AudioNode, ev: NoteEvent, t: number) {
    const f = midiToHz(ev.midi)
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * 1.06, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.4)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(ev.vel * 0.5, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ev.dur)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + ev.dur + 0.05)
  }

  function schedule(events: NoteEvent[], t0: number, out: GainNode) {
    const c = ctx
    if (!c || !reverb) return
    for (const ev of events) {
      const t = t0 + ev.t
      if (ev.voice === 'bell') bell(c, out, reverb, ev, t)
      else if (ev.voice === 'sparkle') bell(c, out, reverb, ev, t, true)
      else if (ev.voice === 'pad') pad(c, out, reverb, ev, t)
      else sub(c, out, ev, t)
    }
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer)
    timer = null
    if (ctx && bus) {
      const old = bus
      const now = ctx.currentTime
      old.gain.cancelScheduledValues(now)
      old.gain.setValueAtTime(old.gain.value, now)
      old.gain.linearRampToValueAtTime(0, now + 0.4)
      window.setTimeout(() => old.disconnect(), 600)
    }
    bus = null
  }

  return {
    unlock() {
      const c = ensure()
      if (c && c.state !== 'running') void c.resume()
    },

    play(events, seed, ambientFrom) {
      const c = ensure()
      if (!c || !master) return
      stop()
      const out = c.createGain()
      out.gain.value = 1
      out.connect(master)
      bus = out
      const t0 = c.currentTime + 0.06
      schedule(events, t0, out)

      // Bucle ambiental: se programa compás a compás con margen, desde el final de la apertura.
      let bar = 0
      let next = t0 + ambientFrom
      timer = window.setInterval(() => {
        if (!ctx || bus !== out) return
        while (next < ctx.currentTime + LOOKAHEAD) {
          schedule(ambientBar(seed, bar), next, out)
          next += AMBIENT_BAR
          bar++
        }
      }, 250)
    },

    stop,

    cue(events) {
      if (!ctx || !bus) return
      schedule(events, ctx.currentTime + 0.02, bus)
    },

    setRain(level) {
      const c = ensure()
      if (!c || !master) return
      if (!rain) {
        // Ruido blanco en bucle, filtrado en banda: suena a lluvia fina, no a interferencia.
        const len = c.sampleRate * 2
        const buf = c.createBuffer(1, len, c.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
        const src = c.createBufferSource()
        src.buffer = buf
        src.loop = true
        const band = c.createBiquadFilter()
        band.type = 'bandpass'
        band.frequency.value = 1400
        band.Q.value = 0.6
        rain = c.createGain()
        rain.gain.value = 0
        src.connect(band).connect(rain).connect(master)
        src.start()
      }
      const now = c.currentTime
      rain.gain.cancelScheduledValues(now)
      rain.gain.setValueAtTime(rain.gain.value, now)
      rain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)) * 0.07, now + 1.2)
    },

    setMuted(m) {
      muted = m
      if (!ctx || !master) return
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(m ? 0 : MASTER, now + 0.25)
    },

    suspend() {
      if (ctx?.state === 'running') void ctx.suspend()
    },
    resume() {
      if (ctx?.state === 'suspended') void ctx.resume()
    },

    dispose() {
      stop()
      void ctx?.close()
      ctx = null
      master = null
      reverb = null
    },
  }
}
