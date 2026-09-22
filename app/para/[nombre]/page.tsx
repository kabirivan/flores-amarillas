import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cleanMessage, cleanName, safeDecode } from '@/lib/link/sanitize'
import { OpeningStage } from '@/components/opening/OpeningStage'
import { BouquetExperience } from '@/components/story/BouquetExperience'

type Props = {
  params: Promise<{ nombre: string }>
  searchParams: Promise<{ de?: string | string[]; m?: string | string[]; apertura?: string | string[]; p?: string | string[]; rot?: string | string[]; t?: string | string[] }>
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nombre } = await params
  const name = cleanName(safeDecode(nombre))
  if (!name) return { title: 'Flores amarillas' }
  // Lo que se ve al compartir el enlace (WhatsApp, iMessage…): íntimo, no técnico.
  const title = `${name}, estas flores son solo para ti 🌻`
  const description = `Un ramo de girasoles que crece flor a flor, pensado solo para ti, ${name}. Nadie más tiene uno igual. Ábrelo con calma 💛`
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', locale: 'es_ES', siteName: 'Flores amarillas', url: `/para/${encodeURIComponent(name)}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function Page({ params, searchParams }: Props) {
  const [{ nombre }, query] = await Promise.all([params, searchParams])
  const name = cleanName(safeDecode(nombre))
  if (!name) notFound()

  // Los ramos siempre los regala Xavi (se ignora ?de=).
  const from = 'Xavi'
  const message = cleanMessage(first(query.m))
  const apertura = first(query.apertura)

  // La apertura por tiempo (sin 3D), para comparar; también es el respaldo sin WebGL2.
  if (apertura === 'jardin') return <OpeningStage name={name} from={from} message={message} />

  // Arnés de verificación: `?t=N` congela el instante N (segundos) del ramo.
  const t = Number.parseFloat(first(query.t) ?? '')
  return <BouquetExperience name={name} from={from} message={message} seek={Number.isFinite(t) ? Math.max(0, t) : null} />
}
