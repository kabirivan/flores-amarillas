import type { Metadata } from 'next'
import { StoryExperience } from '@/components/story/StoryExperience'

const title = 'Flores amarillas · La historia'
const description = 'Una semilla de luz que florece con el scroll: la historia completa del ramo de flores amarillas.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website', locale: 'es_ES', siteName: 'Flores amarillas' },
}

type Props = { searchParams: Promise<{ p?: string | string[] }> }

/**
 * La historia con scroll (el storytelling original): semilla → lluvia → sol → el jardín
 * florece → el ramo se forma flor a flor → recorrido de cámara → final. Genérica: «Para ti».
 * La enlaza, discreta, la sección del proyecto en el portafolio.
 */
export default async function Historia({ searchParams }: Props) {
  const raw = (await searchParams).p
  const p = Number.parseFloat((Array.isArray(raw) ? raw[0] : raw) ?? '')
  return <StoryExperience name="ti" from="Xavi" message="" seek={Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null} />
}
