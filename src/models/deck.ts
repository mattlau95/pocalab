import type { Card } from './card'

export const DECK_MAX_CARDS = 9

export interface Deck {
  cards: Card[]
  copies: Record<string, number>
}

export function createDeck(): Deck {
  return { cards: [], copies: {} }
}
