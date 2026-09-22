import type { Wrap } from '@/lib/bouquet/types'
import { GREENS, YELLOWS, toneAt } from '@/lib/bouquet/palette'

/**
 * Degradados compartidos por todo el ramo. Dan volumen sin filtros: la base de cada pétalo
 * es más profunda y la punta atrapa la luz; el papel se oscurece hacia los pliegues.
 */
export function Defs({ uid, glow, wrap }: { uid: string; glow: string; wrap: Wrap }) {
  const { paper, ribbon, tissue } = wrap
  return (
    <defs>
      {YELLOWS.map((_, i) => {
        const tone = toneAt(i)
        return (
          <linearGradient key={i} id={`${uid}-p${i}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={tone.shade} />
            <stop offset="0.45" stopColor={tone.base} />
            <stop offset="1" stopColor={tone.light} />
          </linearGradient>
        )
      })}

      {/* Hojas: más claras en el nervio, más oscuras en el borde. */}
      {[GREENS.mid, GREENS.light].map((c, i) => (
        <linearGradient key={c} id={`${uid}-leaf${i}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GREENS.deep} />
          <stop offset="0.5" stopColor={c} />
          <stop offset="1" stopColor={GREENS.deep} />
        </linearGradient>
      ))}

      {/* Capullo: verde que empieza a amarillear en la punta. */}
      <linearGradient id={`${uid}-bud`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={GREENS.deep} />
        <stop offset="0.6" stopColor={GREENS.light} />
        <stop offset="1" stopColor="#D8D46A" />
      </linearGradient>

      {/* Papel: la hoja izquierda recibe menos luz y se oscurece hacia su borde exterior. */}
      <linearGradient id={`${uid}-paper-l`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={paper.edge} />
        <stop offset="0.55" stopColor={paper.fold} />
        <stop offset="1" stopColor={paper.base} />
      </linearGradient>
      <linearGradient id={`${uid}-paper-r`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={paper.base} />
        <stop offset="0.6" stopColor={paper.base} />
        <stop offset="1" stopColor={paper.fold} />
      </linearGradient>
      <linearGradient id={`${uid}-tissue`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={tissue.base} />
        <stop offset="1" stopColor={tissue.shade} />
      </linearGradient>
      <linearGradient id={`${uid}-ribbon`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={ribbon.base} />
        <stop offset="1" stopColor={ribbon.shade} />
      </linearGradient>

      {/* Sombra suave: contacto entre flores y sombra del ramo en el suelo. */}
      <radialGradient id={`${uid}-shadow`}>
        <stop offset="0" stopColor="#140E1C" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="#140E1C" stopOpacity="0.22" />
        <stop offset="1" stopColor="#140E1C" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-halo`}>
        <stop offset="0" stopColor={glow} stopOpacity="0.55" />
        <stop offset="0.45" stopColor={glow} stopOpacity="0.16" />
        <stop offset="1" stopColor={glow} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-core`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#B45309" />
        <stop offset="0.7" stopColor="#6B3410" />
        <stop offset="1" stopColor="#4A220A" />
      </radialGradient>
      <radialGradient id={`${uid}-core-daisy`} cx="0.4" cy="0.35" r="0.75">
        <stop offset="0" stopColor="#FFB627" />
        <stop offset="1" stopColor="#C2610A" />
      </radialGradient>
    </defs>
  )
}

/** Degradado de hoja según su color base. */
export const leafFill = (uid: string, color: string): string =>
  `url(#${uid}-leaf${color === GREENS.light ? 1 : 0})`
