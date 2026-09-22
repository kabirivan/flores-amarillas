import { CreateForm } from '@/components/home/CreateForm'
import styles from '@/components/home/Home.module.css'

export const metadata = {
  title: 'Flores amarillas · 21 de septiembre',
  description: 'Regala un ramo de flores amarillas hecho de luz, con su nombre.',
}

/** Portada: escribir el nombre y abrir su ramo. */
export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>21 de septiembre</p>
        <h1 className={styles.title}>Flores amarillas</h1>
        <p className={styles.lead}>Un ramo de girasoles hecho de luz, que crece con su nombre.</p>
        <CreateForm />
      </div>
    </main>
  )
}
