import { useReducer } from 'react'
import { createDeck, DECK_MAX_CARDS, type Deck } from '../models/deck'
import type { Card } from '../models/card'

type Action =
  | { type: 'ADD_CARD'; card: Card }
  | { type: 'REMOVE_CARD'; id: string }
  | { type: 'SET_COPIES'; id: string; count: number }

function deckReducer(deck: Deck, action: Action): Deck {
  switch (action.type) {
    case 'ADD_CARD':
      if (deck.cards.length >= DECK_MAX_CARDS) return deck
      return {
        cards: [...deck.cards, action.card],
        copies: { ...deck.copies, [action.card.id]: 1 },
      }
    case 'REMOVE_CARD': {
      const copies = { ...deck.copies }
      delete copies[action.id]
      return { cards: deck.cards.filter(c => c.id !== action.id), copies }
    }
    case 'SET_COPIES':
      return { ...deck, copies: { ...deck.copies, [action.id]: action.count } }
    default:
      return deck
  }
}

export function useDeck() {
  const [deck, dispatch] = useReducer(deckReducer, undefined, createDeck)

  return {
    deck,
    addCard: (card: Card) => dispatch({ type: 'ADD_CARD', card }),
    removeCard: (id: string) => dispatch({ type: 'REMOVE_CARD', id }),
    setCopies: (id: string, count: number) => dispatch({ type: 'SET_COPIES', id, count }),
  }
}
