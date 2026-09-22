import styles from './SkyBackdrop.module.css'

/** Cielo de fondo. Los colores vienen de variables CSS; en la fase c cambiarán con la hora local. */
export function SkyBackdrop() {
  return <div className={styles.sky} aria-hidden="true" />
}
