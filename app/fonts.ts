import { Ephesis, Fraunces, Inter } from 'next/font/google'

/** Manuscrita, solo para el nombre de quien recibe. */
export const script = Ephesis({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-script',
})

/** Serif con carácter para títulos y el certificado. */
export const serif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-serif',
})

/** UI: que desaparezca. */
export const sans = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-sans',
})
