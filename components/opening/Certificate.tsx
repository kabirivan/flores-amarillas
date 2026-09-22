import type { Bouquet } from '@/lib/bouquet/types'
import styles from './Certificate.module.css'

export function Certificate({ bouquet, name }: { bouquet: Bouquet; name: string }) {
  return (
    <p className={styles.cert}>
      Ramo n.º {bouquet.serial} <span aria-hidden="true">·</span> {bouquet.flowers.length} flores{' '}
      <span aria-hidden="true">·</span> cultivado para {name}
    </p>
  )
}
