import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BouquetExperience } from '@/components/story/BouquetExperience'
import { RAMOS, ramoById } from '@/lib/bouquet/catalog'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string | string[] }> }

export const dynamicParams = false
export const generateStaticParams = () => RAMOS.map((r) => ({ id: r.id }))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ramo = ramoById((await params).id)
  if (!ramo) return {}
  const title = `${ramo.name} para ti 🌻`
  const description = `${ramo.blurb} Un ramo de flores amarillas que crece flor a flor, solo para ti 💛`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', locale: 'es_ES', siteName: 'Flores amarillas' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

/** Un ramo del catálogo: la misma experiencia, con sus flores. Siempre «Para ti», de Xavi. */
export default async function Page({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  if (!ramoById(id)) notFound()
  const raw = Array.isArray(query.t) ? query.t[0] : query.t
  const t = Number.parseFloat(raw ?? '')
  return <BouquetExperience name="ti" from="Xavi" message="" ramo={id} seek={Number.isFinite(t) ? Math.max(0, t) : null} />
}
