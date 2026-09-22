'use client'

import type { Bouquet } from '@/lib/bouquet/types'
import { Button } from '@/components/ui/Button'
import { Certificate } from '@/components/opening/Certificate'
import { HandwrittenName } from '@/components/opening/HandwrittenName'
import { CLOSING } from './story'
import styles from './Story.module.css'

/** Modelos 3D de Sketchfab usados en el ramo real (la licencia CC BY exige citarlos). */
const MODEL_CREDITS = [
  { what: 'girasol', author: 'Polygonal Miniatures', url: 'https://sketchfab.com/3d-models/sunflower-569a71ccf4d94c1585c9573521fb998f' },
  { what: 'hojas', author: 'zvanstone', url: 'https://sketchfab.com/3d-models/3a9514b8df044abe809432201b8f1c6e' },
] as const

type Props = { name: string; from: string; message: string; bouquet: Bouquet; height: number; onReplay: () => void }

/** El final: dedicatoria, certificado y el cierre. El ramo está en el lienzo, detrás. */
export function Finale({ name, from, message, bouquet, height, onReplay }: Props) {
  return (
    <section className={styles.finale} style={{ height: `${height * 100}svh` }} aria-labelledby="final-titulo">
      <div className={styles.finaleCard}>
        <h2 id="final-titulo" className={styles.finaleTitle}>
          <span className={styles.forWord}>Para</span>
          <span className="visually-hidden"> {name}</span>
          <HandwrittenName name={name} write={false} className={styles.finaleName} />
        </h2>
        {message ? <p className={styles.message}>{message}</p> : null}
        {from ? <p className={styles.from}>— {from}</p> : null}
        <Certificate bouquet={bouquet} name={name} />
        <p className={styles.closing}>{CLOSING}</p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onReplay}>
            Ver otra vez
          </Button>
        </div>
        <p className={styles.credits}>
          Flores 3D (
          <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          ):{' '}
          {MODEL_CREDITS.map((c, i) => (
            <span key={c.url}>
              {i > 0 ? ' · ' : ''}
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.what}
              </a>{' '}
              de {c.author}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
