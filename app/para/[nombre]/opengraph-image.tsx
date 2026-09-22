import { ImageResponse } from 'next/og'

export const alt = 'Un ramo de girasoles hecho solo para ti'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const KICKER = '21 de septiembre'
const LINE = 'Un ramo de girasoles que crece solo para ti. Nadie más tiene uno igual.'

/** Una fuente de Google Fonts, solo con las letras que hacen falta (TTF, lo que acepta next/og). */
async function googleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch {
    return null
  }
}

/** Girasol de luz: pétalos alrededor de un disco oscuro, con halo. */
function Sunflower() {
  const petals = Array.from({ length: 22 }, (_, i) => (i / 22) * 360)
  return (
    <svg width="340" height="340" viewBox="-170 -170 340 340">
      <defs>
        <radialGradient id="halo">
          <stop offset="0%" stopColor="#ffc46b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffc46b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="petal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe36e" />
          <stop offset="100%" stopColor="#ff9f1a" />
        </linearGradient>
      </defs>
      <circle r="170" fill="url(#halo)" />
      {petals.map((a, i) => (
        <ellipse key={a} cx="0" cy={i % 2 ? -92 : -100} rx="17" ry={i % 2 ? 48 : 56} fill="url(#petal)" opacity={i % 2 ? 0.85 : 1} transform={`rotate(${a})`} />
      ))}
      <circle r="50" fill="#2a1204" />
      <circle r="50" fill="none" stroke="#c0600f" strokeWidth="5" />
      <circle r="30" fill="#4a2208" />
    </svg>
  )
}

/** Genérica: el nombre de la URL no aparece (ver page.tsx). */
export default async function Image() {
  const name = 'ti'
  // Dos fuentes con nombre propio: si solo se carga la manuscrita, se cuela en el resto del texto.
  const [font, sans] = await Promise.all([googleFont('Ephesis', `Para ${name}`), googleFont('Inter', KICKER.toUpperCase() + LINE)])
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 64,
          background: 'radial-gradient(circle at 30% 50%, #2a1d3d 0%, #0b0a18 55%, #04040a 100%)',
          color: '#fdf6ec',
          fontFamily: 'Inter',
        }}
      >
        <Sunflower />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 620 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: '#ffb627' }}>{KICKER.toUpperCase()}</div>
          <div style={{ fontSize: name.length > 12 ? 104 : 140, lineHeight: 1.05, color: '#ffd23f', fontFamily: font ? 'Ephesis' : 'serif', marginTop: 12 }}>
            {`Para ${name}`}
          </div>
          <div style={{ fontSize: 34, color: '#e6dcf0', marginTop: 18, lineHeight: 1.35 }}>{LINE}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(sans ? [{ name: 'Inter', data: sans, style: 'normal' as const, weight: 400 as const }] : []),
        ...(font ? [{ name: 'Ephesis', data: font, style: 'normal' as const, weight: 400 as const }] : []),
      ],
    },
  )
}
