import { petalPath, petalShadePath, petalVeinPath, type PetalShape } from '@/lib/bouquet/geometry'

type Props = { shape: PetalShape; fill: string; shade: string; vein?: boolean }

/** Un pétalo apuntando hacia arriba con la base en el origen: cuerpo, sombra interior y nervio. */
export function Petal({ shape, fill, shade, vein = false }: Props) {
  return (
    <>
      <path d={petalPath(shape)} fill={fill} />
      <path d={petalShadePath(shape)} fill={shade} opacity={0.14} />
      {vein ? (
        <path d={petalVeinPath(shape)} fill="none" stroke={shade} strokeWidth={0.8} strokeLinecap="round" opacity={0.28} />
      ) : null}
    </>
  )
}
