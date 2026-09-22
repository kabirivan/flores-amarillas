import type { Metadata, Viewport } from 'next'
import { script, serif, sans } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  // Las imágenes de vista previa (WhatsApp) necesitan URLs absolutas del dominio público.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amarillo.xavieraguas.com'),
  title: 'Flores amarillas · 21 de septiembre',
  description: 'Un ramo de girasoles hecho de luz, solo para alguien especial.',
}

export const viewport: Viewport = {
  themeColor: '#1A1035',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${script.variable} ${serif.variable} ${sans.variable}`}>
      {/* Las extensiones (Grammarly, ColorZilla…) inyectan atributos en <body>. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
