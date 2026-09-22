import styles from './SoundToggle.module.css'

/** Botón de música, siempre visible. `aria-pressed` = está sonando. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={on}
      aria-label={on ? 'Silenciar la música' : 'Activar la música'}
      title={on ? 'Silenciar la música' : 'Activar la música'}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none" />
        {on ? (
          <>
            <path className={styles.wave} d="M15.5 9a4.2 4.2 0 0 1 0 6" />
            <path className={styles.wave} d="M18 6.5a7.8 7.8 0 0 1 0 11" />
          </>
        ) : (
          <path d="M16 9.5l5 5m0-5l-5 5" />
        )}
      </svg>
    </button>
  )
}
