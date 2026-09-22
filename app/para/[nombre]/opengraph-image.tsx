import { OG_SIZE, flowerCard } from '@/lib/og/flowerCard'

export const alt = 'Un ramo de girasoles hecho solo para ti'
export const size = OG_SIZE
export const contentType = 'image/png'

/** Genérica: el nombre de la URL no aparece (ver page.tsx). */
export default function Image() {
  return flowerCard({ title: 'Para ti' })
}
