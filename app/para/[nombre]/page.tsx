import type { Metadata } from 'next'
import { OpeningStage } from '@/components/opening/OpeningStage'
import { BouquetExperience } from '@/components/story/BouquetExperience'

type Props = { searchParams: Promise<{ apertura?: string | string[]; t?: string | string[] }> }

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/**
 * Genérico: el nombre de la URL no se muestra en ningún sitio (se podía cambiar a mano y
 * poner cualquier cosa). Todos los enlaces /para/… abren el mismo ramo, «Para ti», de Xavi.
 */
const NAME = 'ti'
const FROM = 'Xavi'

const title = 'Estas flores son solo para ti 🌻'
const description = 'Un ramo de girasoles que crece flor a flor, pensado solo para ti. Ábrelo con calma 💛'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: 'website', locale: 'es_ES', siteName: 'Flores amarillas' },
  twitter: { card: 'summary_large_image', title, description },
}

export default async function Page({ searchParams }: Props) {
  const query = await searchParams
  // La apertura por tiempo (sin 3D), para comparar; también es el respaldo sin WebGL2.
  if (first(query.apertura) === 'jardin') return <OpeningStage name={NAME} from={FROM} message="" />
  // Arnés de verificación: `?t=N` congela el instante N (segundos) del ramo.
  const t = Number.parseFloat(first(query.t) ?? '')
  return <BouquetExperience name={NAME} from={FROM} message="" seek={Number.isFinite(t) ? Math.max(0, t) : null} />
}
