import { useReducer, useEffect } from 'react'
import { createDeck, DECK_MAX_CARDS, type Deck } from '../models/deck'
import type { Card } from '../models/card'

const STORAGE_KEY = 'photocard-deck'

function sumCopies(copies: Record<string, number>): number {
  return Object.values(copies).reduce((s, c) => s + c, 0)
}

type Action =
  | { type: 'ADD_CARD'; card: Card }
  | { type: 'REMOVE_CARD'; id: string }
  | { type: 'SET_COPIES'; id: string; count: number }
  | { type: 'UPDATE_CARD'; id: string; patch: Partial<Pick<Card, 'front' | 'back'>> }
  | { type: 'SET_SHARED_BACK'; dataUrl: string | null }

function deckReducer(deck: Deck, action: Action): Deck {
  switch (action.type) {
    case 'ADD_CARD':
      if (sumCopies(deck.copies) >= DECK_MAX_CARDS) return deck
      return {
        ...deck,
        cards: [...deck.cards, action.card],
        copies: { ...deck.copies, [action.card.id]: 1 },
      }
    case 'REMOVE_CARD': {
      const copies = { ...deck.copies }
      delete copies[action.id]
      return { ...deck, cards: deck.cards.filter(c => c.id !== action.id), copies }
    }
    case 'SET_COPIES': {
      if (action.count < 1) return deck
      const current = deck.copies[action.id] ?? 1
      const newTotal = sumCopies(deck.copies) - current + action.count
      if (newTotal > DECK_MAX_CARDS) return deck
      return { ...deck, copies: { ...deck.copies, [action.id]: action.count } }
    }
    case 'UPDATE_CARD':
      return {
        ...deck,
        cards: deck.cards.map(c => c.id === action.id ? { ...c, ...action.patch } : c),
      }
    case 'SET_SHARED_BACK':
      return { ...deck, sharedBack: action.dataUrl }
    default:
      return deck
  }
}

function loadDeck(): Deck {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...createDeck(), ...JSON.parse(raw) } as Deck
  } catch { /* storage unavailable or corrupt */ }
  return createDeck()
}

export function useDeck() {
  const [deck, dispatch] = useReducer(deckReducer, undefined, loadDeck)
  const total = sumCopies(deck.copies)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deck))
    } catch { /* storage full — silently skip */ }
  }, [deck])

  return {
    deck,
    total,
    addCard: (card: Card) => dispatch({ type: 'ADD_CARD', card }),
    removeCard: (id: string) => dispatch({ type: 'REMOVE_CARD', id }),
    setCopies: (id: string, count: number) => dispatch({ type: 'SET_COPIES', id, count }),
    updateCard: (id: string, patch: Partial<Pick<Card, 'front' | 'back'>>) =>
      dispatch({ type: 'UPDATE_CARD', id, patch }),
    setSharedBack: (dataUrl: string | null) => dispatch({ type: 'SET_SHARED_BACK', dataUrl }),
  }
}
