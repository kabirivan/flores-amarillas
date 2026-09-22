import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cleanMessage, cleanName, safeDecode } from '@/lib/link/sanitize'
import { OpeningStage } from '@/components/opening/OpeningStage'
import { StoryExperience } from '@/components/story/StoryExperience'

type Props = {
  params: Promise<{ nombre: string }>
  searchParams: Promise<{ de?: string | string[]; m?: string | string[]; apertura?: string | string[]; p?: string | string[]; rot?: string | string[] }>
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/** `?p=N` congela la historia en ese punto del scroll (0–1), arnés de verificación. */
const progressParam = (raw: string | undefined): number | null => {
  if (raw === undefined) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = cleanName(safeDecode((await params).nombre))
  return { title: name ? `${name}, tienes flores amarillas 🌼` : 'Flores amarillas' }
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

  return (
    <StoryExperience
      name={name}
      from={from}
      message={message}
      seek={progressParam(first(query.p))}
      rotation={Number.parseFloat(first(query.rot) ?? '0') || 0}
    />
  )
}
