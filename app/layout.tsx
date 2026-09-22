import type { Metadata, Viewport } from 'next'
import { script, serif, sans } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Flores amarillas · 21 de septiembre',
  description: 'Un ramo de flores amarillas, único para cada nombre, que se abre al tocarlo.',
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
