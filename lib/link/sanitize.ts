/**
 * Saneado de todo lo que llega por la URL. Soporta tildes, ñ, diéresis, apóstrofos y
 * nombres compuestos ("José Antonio", "María-Jesús", "D'Artagnan").
 */

export const LIMITS = { name: 40, from: 40, message: 180 } as const

// Controles C0/C1, marcas bidireccionales y caracteres de ancho cero salvo el ZWJ,
// que hace falta para los emoji compuestos.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F​‌‎‏‪-‮⁦-⁩﻿]/g

/** Corta por grafemas, no por unidades UTF-16: nunca parte una letra con tilde ni un emoji. */
function clip(text: string, max: number): string {
  const seg = new Intl.Segmenter('es', { granularity: 'grapheme' })
  let out = ''
  let count = 0
  for (const { segment } of seg.segment(text)) {
    if (count >= max) break
    out += segment
    count++
  }
  return out
}

export function cleanText(raw: unknown, max: number, { multiline = false } = {}): string {
  if (typeof raw !== 'string') return ''
  let text = raw.normalize('NFC').replace(INVISIBLE, (ch) => (multiline && ch === '\n' ? '\n' : ' '))
  text = multiline
    ? text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ')
  return clip(text.trim(), max).trim()
}

export const cleanName = (raw: unknown): string => cleanText(raw, LIMITS.name)
export const cleanFrom = (raw: unknown): string => cleanText(raw, LIMITS.from)
export const cleanMessage = (raw: unknown): string =>
  cleanText(raw, LIMITS.message, { multiline: true })

/**
 * La semilla del ramo: el nombre saneado, en minúsculas y con las letras compuestas
 * normalizadas. "María", "maría " y "MARÍA" dan el mismo ramo; "Maria" sin tilde no.
 */
export function seedFromName(name: string): string {
  return cleanName(name).toLocaleLowerCase('es').normalize('NFC')
}

/** Largo percibido: "José" son 4 letras aunque en NFD sean 5 unidades. */
export function graphemeLength(text: string): number {
  const seg = new Intl.Segmenter('es', { granularity: 'grapheme' })
  let count = 0
  for (const _ of seg.segment(text)) count++
  return count
}

/** Decodificación segura de un segmento de ruta. Nunca lanza. */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
