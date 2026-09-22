import styles from '@/components/home/Home.module.css'

export const metadata = {
  title: 'Flores amarillas · Xavier Aguas',
  description: 'Creado por Xavier Aguas.',
  robots: { index: false },
}

/** Portada: solo la firma. Los ramos se abren con su enlace (/para/{nombre}). */
export default function Home() {
  return (
    <main className={styles.page}>
      <a className={styles.signature} href="https://xavieraguas.com" target="_blank" rel="noopener">
        <span className={styles.by}>Creado por</span>
        <span className={styles.name}>Xavier Aguas</span>
        <span className={styles.site}>xavieraguas.com</span>
      </a>
    </main>
  )
}
