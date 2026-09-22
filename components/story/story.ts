/**
 * La historia: textos originales, de amistad, con los nombres del enlace dentro.
 * Función pura: se testea con y sin remitente.
 */

/** Un trozo de frase; los nombres se pintan con la letra manuscrita. */
export type Segment = { text: string; name?: true }

export type ChapterId = 'semilla' | 'encuentro' | 'cuidar' | 'lluvia' | 'sol' | 'florecer' | 'ramo'

export type Chapter = { id: ChapterId; line: Segment[] }

export const CLOSING = 'No esperes a otro 21 de septiembre para decirle a alguien que lo quieres.'

const t = (text: string): Segment => ({ text })
const n = (text: string): Segment => ({ text, name: true })

/**
 * La protagonista es la semilla: llega con el nombre de quien recibe. Quien envía no
 * aparece en la historia; firma al final, en la dedicatoria.
 */
export function storyFor(para: string): Chapter[] {
  return [
    { id: 'semilla', line: [t('Hace tiempo, en la noche más larga, cayó una semilla de luz.')] },
    // Genérica («ti»): el nombre escondido es el de quien lo lee.
    { id: 'encuentro', line: [t('Llevaba un nombre escondido: '), n(para === 'ti' ? 'el tuyo' : para), t('.')] },
    { id: 'cuidar', line: [t('Nadie sabía en qué se convertiría. Solo que había que cuidarla.')] },
    { id: 'lluvia', line: [t('Hubo días de lluvia…')] },
    { id: 'sol', line: [t('…y días en que el sol no se quería ir.')] },
    { id: 'florecer', line: [t('Porque lo que se cuida con cariño, florece.')] },
    { id: 'ramo', line: [t('Cada 21 de septiembre.')] },
  ]
}

/** Texto plano de una frase (para lectores de pantalla y tests). */
export const plain = (c: Chapter): string => c.line.map((s) => s.text).join('')
