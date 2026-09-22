import { generateBouquet, describeBouquet } from '@/lib/bouquet'
import { BouquetSVG } from '@/components/bouquet/BouquetSVG'
import { SkyBackdrop } from '@/components/scene/SkyBackdrop'

export const metadata = { title: 'Jardín · Flores amarillas', robots: { index: false } }

const NAMES = ['Ana', 'María', 'José Antonio', 'Sofía', 'Íñigo', 'María de los Ángeles', 'Lu', 'Xavi', 'Begoña']

/** Página de trabajo: varios ramos lado a lado para juzgar variedad y dibujo. */
export default function Jardin() {
  return (
    <main style={{ padding: 24 }}>
      <SkyBackdrop />
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {NAMES.map((name) => {
          const b = generateBouquet(name)
          return (
            <figure key={name} style={{ margin: 0, textAlign: 'center' }}>
              <BouquetSVG bouquet={b} label={describeBouquet(b)} className="jardin-svg" />
              <figcaption style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                {name} · n.º {b.serial} · {b.flowers.length} flores
              </figcaption>
            </figure>
          )
        })}
      </div>
      <style>{`.jardin-svg{width:100%;height:auto;display:block}`}</style>
    </main>
  )
}
