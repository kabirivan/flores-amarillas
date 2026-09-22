import { OG_SIZE, flowerCard } from '@/lib/og/flowerCard'

export const alt = 'Una historia que florece: flores amarillas para ti'
export const size = OG_SIZE
export const contentType = 'image/png'

export default function Image() {
  return flowerCard({ title: 'Para ti', line: 'Una semilla de luz que florece contigo. Ábrela con calma.' })
}
