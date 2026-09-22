import Link from 'next/link'
import styles from '@/components/home/Home.module.css'

export const metadata = {
  title: 'Flores amarillas · Xavier Aguas',
  description: 'Creado por Xavier Aguas.',
  robots: { index: false },
}

/** Portada: un botón que abre el ramo («Para ti») y la firma. Los ramos personales se abren con su enlace (/para/{nombre}). */
export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.stack}>
      <Link className={styles.cta} href="/para/ti">
        <span className={styles.ctaFlower} aria-hidden="true">
          🌻
        </span>
        <span>Ver mis flores amarillas</span>
      </Link>
      <a className={styles.signature} href="https://xavieraguas.com" target="_blank" rel="noopener">
        <span className={styles.by}>Creado por</span>
        <span className={styles.name}>Xavier Aguas</span>
        <span className={styles.site}>xavieraguas.com</span>
      </a>
      </div>
    </main>
  )
}
