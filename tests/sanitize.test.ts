import { describe, expect, it } from 'vitest'
import { cleanMessage, cleanName, graphemeLength, LIMITS, safeDecode, seedFromName } from '@/lib/link/sanitize'

describe('sanitize', () => {
  it('conserva tildes, ñ, diéresis, guiones y apóstrofos', () => {
    expect(cleanName('Begoña')).toBe('Begoña')
    expect(cleanName('Agüero')).toBe('Agüero')
    expect(cleanName('María-Jesús')).toBe('María-Jesús')
    expect(cleanName("D'Artagnan")).toBe("D'Artagnan")
    expect(cleanName('José Antonio')).toBe('José Antonio')
  })

  it('colapsa espacios y recorta', () => {
    expect(cleanName('  José    Antonio \t')).toBe('José Antonio')
  })

  it('normaliza a NFC', () => {
    expect(cleanName('José')).toBe('José')
    expect(cleanName('José').length).toBe(4)
  })

  it('elimina caracteres de control y marcas bidi', () => {
    expect(cleanName('Ana\u0000‮')).toBe('Ana')
    expect(cleanName('A​na')).toBe('A na')
  })

  it('no acepta tipos que no son texto', () => {
    expect(cleanName(undefined)).toBe('')
    expect(cleanName(42)).toBe('')
    expect(cleanName(['Ana'])).toBe('')
  })

  it('limita por grafemas, sin partir emoji ni letras compuestas', () => {
    const long = 'ñ'.repeat(100)
    expect(graphemeLength(cleanName(long))).toBe(LIMITS.name)
    const family = '👨‍👩‍👧'
    expect(cleanName(family.repeat(50))).toBe(family.repeat(LIMITS.name))
  })

  it('el mensaje admite saltos de línea pero no más de uno en blanco', () => {
    expect(cleanMessage('Hola\n\n\n\nqué tal')).toBe('Hola\n\nqué tal')
    expect(graphemeLength(cleanMessage('x'.repeat(500)))).toBe(LIMITS.message)
  })

  it('la semilla ignora mayúsculas y espacios de más', () => {
    expect(seedFromName(' MARÍA ')).toBe('maría')
  })

  it('safeDecode nunca lanza', () => {
    expect(safeDecode('Mar%C3%ADa')).toBe('María')
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A')
  })
})
