import { OG_SIZE, flowerCard } from '@/lib/og/flowerCard'
import { RAMOS, ramoById } from '@/lib/bouquet/catalog'

export const alt = 'Un ramo de flores amarillas para ti'
export const size = OG_SIZE
export const contentType = 'image/png'
export const generateStaticParams = () => RAMOS.map((r) => ({ id: r.id }))

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const ramo = ramoById((await params).id)
  if (!ramo) return flowerCard({ title: 'Para ti' })
  return flowerCard({ kicker: ramo.name, title: 'Para ti', line: `${ramo.blurb} Solo para ti.` })
}
