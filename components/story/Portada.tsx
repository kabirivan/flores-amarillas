'use client'

import * as m from 'motion/react-m'
import { Button } from '@/components/ui/Button'
import { Envelope } from '@/components/opening/Envelope'
import { HandwrittenName } from '@/components/opening/HandwrittenName'
import styles from './Story.module.css'

type Props = { name: string; from: string; leaving: boolean; animate: boolean; onStart: () => void }

/** La puerta del ramo: sobre, nombre escrito a mano y «Comenzar» (el gesto que desbloquea el audio). */
export function Portada({ name, from, leaving, animate, onStart }: Props) {
  return (
    <m.div
      className={styles.portada}
      initial={false}
      animate={leaving ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      inert={leaving}
    >
      <div className={styles.portadaStage}>
        <Envelope state={leaving ? 'open' : 'closed'} breathe={animate} />
      </div>
      <div className={styles.portadaCard}>
        <h1 className={styles.portadaTitle}>
          <span className="visually-hidden">Para {name}</span>
          <HandwrittenName name={name} delay={0.35} write={animate} className={styles.portadaName} />
        </h1>
        <p className={styles.lede}>{from ? `${from} te dejó unas flores` : 'Alguien te dejó unas flores'}</p>
        <Button onClick={onStart} aria-label={`Abrir las flores de ${name}`}>
          Ábrelas <span aria-hidden="true">✧</span>
        </Button>
        <p className={styles.hint}>Mejor con sonido</p>
      </div>
    </m.div>
  )
}
