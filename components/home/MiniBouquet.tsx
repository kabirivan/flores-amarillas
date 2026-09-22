import { ramoKinds, type LineKind, type Ramo } from '@/lib/bouquet/catalog'

/**
 * Miniatura del ramo en líneas de neón (SVG, sin 3D): un cono de hilos, los tallos en abanico
 * y un icono por flor según su especie. Mismo orden de flores que el ramo animado.
 */

const GOLD = '#ffd23f'
const AMBER = '#ff9f1a'
const PALE = '#fff3b0'
const DARK = '#5a2a08'
const GREEN = '#3ddc84'

/** Icono de cada especie, centrado en (0,0), de radio ~1. */
function Glyph({ kind }: { kind: LineKind }) {
  switch (kind) {
    case 'sunflower':
      return (
        <g>
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse key={i} cx="0" cy="-0.62" rx="0.16" ry="0.4" transform={`rotate(${(i / 14) * 360})`} fill="none" stroke={GOLD} strokeWidth="0.08" />
          ))}
          <circle r="0.3" fill={DARK} stroke={AMBER} strokeWidth="0.08" />
        </g>
      )
    case 'daisy':
      return (
        <g>
          {Array.from({ length: 18 }, (_, i) => (
            <line key={i} x1="0" y1="-0.22" x2="0" y2="-0.95" transform={`rotate(${(i / 18) * 360})`} stroke={PALE} strokeWidth="0.1" strokeLinecap="round" />
          ))}
          <circle r="0.2" fill={AMBER} />
        </g>
      )
    case 'gerbera':
      return (
        <g>
          {Array.from({ length: 24 }, (_, i) => (
            <line key={i} x1="0" y1="-0.3" x2="0" y2="-1" transform={`rotate(${(i / 24) * 360})`} stroke={GOLD} strokeWidth="0.09" strokeLinecap="round" />
          ))}
          <circle r="0.28" fill={DARK} stroke="#e07a10" strokeWidth="0.08" />
        </g>
      )
    case 'rose':
      return (
        <g fill="none" stroke={GOLD} strokeWidth="0.1" strokeLinecap="round">
          <path d="M0 -0.15 A0.2 0.2 0 1 1 -0.2 0.05 A0.45 0.45 0 1 0 0.35 -0.35 A0.75 0.75 0 1 1 -0.7 0.2" />
          <path d="M-0.85 0.25 Q0 1.05 0.85 0.25" stroke={AMBER} />
        </g>
      )
    case 'tulip':
      return (
        <g fill="none" stroke={GOLD} strokeWidth="0.1" strokeLinejoin="round">
          <path d="M-0.6 -0.7 L-0.3 -0.2 L0 -0.8 L0.3 -0.2 L0.6 -0.7 Q0.7 0.7 0 0.8 Q-0.7 0.7 -0.6 -0.7 Z" />
          <path d="M0 -0.8 Q0.15 0 0 0.8" stroke={AMBER} />
        </g>
      )
    case 'mimosa':
      return (
        <g fill="none" stroke={GOLD} strokeWidth="0.09">
          {[
            [0, -0.5],
            [-0.5, -0.1],
            [0.5, -0.15],
            [-0.2, 0.35],
            [0.3, 0.4],
            [0.05, 0],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.24" />
          ))}
        </g>
      )
    case 'freesia':
      return (
        <g fill="none" strokeWidth="0.09">
          <path d="M-0.9 0.6 Q-0.2 -0.9 0.9 -0.4" stroke={GREEN} />
          {[
            [-0.65, 0.1, 0.3],
            [-0.3, -0.35, 0.26],
            [0.15, -0.55, 0.22],
            [0.6, -0.5, 0.16],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} stroke={i < 2 ? GOLD : PALE} />
          ))}
        </g>
      )
  }
}

export function MiniBouquet({ ramo }: { ramo: Ramo }) {
  const kinds = ramoKinds(ramo)
  // Como mucho 16 flores en la miniatura (se leen mejor); se conservan las proporciones.
  const shown = kinds.length > 16 ? kinds.filter((_, i) => i % Math.ceil(kinds.length / 16) === 0) : kinds
  const n = shown.length
  const bind = { x: 50, y: 74 }
  const heads = shown.map((kind, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const a = ((t - 0.5) * 120 * Math.PI) / 180
    const row = i % 3
    const len = 34 + row * 7 - Math.abs(t - 0.5) * 8
    return { kind, x: bind.x + Math.sin(a) * len, y: bind.y - Math.cos(a) * len, s: 6.4 - row * 0.6 }
  })
  return (
    <svg viewBox="0 0 100 100" className="mini-bouquet" aria-hidden="true">
      <defs>
        <filter id="neon" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#neon)">
        {/* Tallos. */}
        {heads.map((h, i) => (
          <path key={`s${i}`} d={`M${bind.x} ${bind.y + 6} Q${(bind.x + h.x) / 2} ${(bind.y + h.y) / 2 + 6} ${h.x} ${h.y}`} fill="none" stroke={GREEN} strokeWidth="0.6" opacity="0.8" />
        ))}
        {/* Cono de papel: hilos que se cruzan. */}
        {Array.from({ length: 9 }, (_, i) => {
          const x = 36 + i * 3.5
          return <path key={`c${i}`} d={`M${x} ${bind.y - 4} L${100 - x} 97`} stroke="#e8c9a0" strokeWidth="0.35" opacity="0.55" />
        })}
        {/* Flores, las de atrás primero. */}
        {[...heads]
          .map((h, i) => ({ ...h, i }))
          .sort((a, b) => a.y - b.y)
          .map((h) => (
            <g key={`h${h.i}`} transform={`translate(${h.x} ${h.y}) scale(${h.s})`}>
              <Glyph kind={h.kind} />
            </g>
          ))}
      </g>
    </svg>
  )
}
