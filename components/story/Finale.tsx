'use client'

import { Button } from '@/components/ui/Button'
import { HandwrittenName } from '@/components/opening/HandwrittenName'
import { CLOSING } from './story'
import styles from './Story.module.css'

type Props = { name: string; from: string; message: string; height: number; onReplay: () => void }

/** El final: dedicatoria y cierre. El ramo está en el lienzo, detrás. */
export function Finale({ name, from, message, height, onReplay }: Props) {
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
        <p className={styles.closing}>{CLOSING}</p>
        {from ? <p className={styles.special}>Si este enlace llegó a ti, es porque eres alguien muy especial para {from} 💛</p> : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onReplay}>
            Ver otra vez
          </Button>
        </div>
        <a className={styles.site} href="https://xavieraguas.com" target="_blank" rel="noopener">
          xavieraguas.com
        </a>
      </div>
    </section>
  )
}
