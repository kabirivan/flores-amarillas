import Link from 'next/link'
import { MiniBouquet } from '@/components/home/MiniBouquet'
import styles from '@/components/home/Home.module.css'
import { RAMOS, describeRamo } from '@/lib/bouquet/catalog'

export const metadata = {
  title: 'Flores amarillas · Xavier Aguas',
  description: 'Ramos de flores amarillas hechos de luz. Creado por Xavier Aguas.',
  robots: { index: false },
}

/** Portada: el botón al ramo «Para ti», los diez ramos del catálogo y la firma. */
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

        <section className={styles.catalog} aria-labelledby="ramos">
          <h2 id="ramos" className={styles.catalogTitle}>
            Elige un ramo
          </h2>
          <ul className={styles.grid}>
            {RAMOS.map((r) => (
              <li key={r.id}>
                <Link className={styles.card} href={`/ramo/${r.id}`}>
                  <MiniBouquet ramo={r} />
                  <span className={styles.cardName}>{r.name}</span>
                  <span className={styles.cardCount}>{describeRamo(r)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Link className={styles.story} href="/historia">
          ✧ Ver la historia completa
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
