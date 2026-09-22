import type { ComponentType } from 'react'
import type { Flower, Species } from '@/lib/bouquet/types'
import { Sunflower } from './Sunflower'
import { Daisy } from './Daisy'
import { Tulip } from './Tulip'
import { Freesia } from './Freesia'
import { Mimosa } from './Mimosa'

export const FLOWER_COMPONENTS: Record<Species, ComponentType<{ flower: Flower }>> = {
  sunflower: Sunflower,
  daisy: Daisy,
  tulip: Tulip,
  freesia: Freesia,
  mimosa: Mimosa,
}
