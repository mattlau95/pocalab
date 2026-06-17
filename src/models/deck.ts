import type { Card } from './card'
import { type PrintPreset, DEFAULT_PRESET } from './preset'

export interface Deck {
  cards: Card[]
  copies: Record<string, number>
  sharedBack: string | null
}

export function createDeck(): Deck {
  return { cards: [], copies: {}, sharedBack: null }
}

export interface Project {
  preset: PrintPreset
  decks: Deck[]
}

export function createProject(preset: PrintPreset = DEFAULT_PRESET): Project {
  return { preset, decks: [createDeck()] }
}
