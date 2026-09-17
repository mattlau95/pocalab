import { useReducer, useEffect, useRef, useState } from 'react'
import { createDeck, createProject, type Deck, type Project } from '../models/deck'
import { PRESETS, DEFAULT_PRESET, type PrintPreset } from '../models/preset'
import type { Card } from '../models/card'
import { readStoredProject, writeStoredProject, LEGACY_LOCAL_KEYS } from '../utils/projectStore'

const STORAGE_KEY = 'photocard-project'
const LEGACY_KEY = 'photocard-deck'

export function deckTotal(deck: Deck): number {
  return Object.values(deck.copies).reduce((s, c) => s + c, 0)
}

type Action =
  | { type: 'SET_PRESET'; preset: PrintPreset }
  | { type: 'ADD_DECK' }
  | { type: 'REMOVE_DECK'; deckIndex: number }
  | { type: 'RESET' }
  | { type: 'ADD_CARD'; deckIndex: number; card: Card }
  | { type: 'REMOVE_CARD'; deckIndex: number; id: string }
  | { type: 'SET_COPIES'; deckIndex: number; id: string; count: number }
  | { type: 'UPDATE_CARD'; deckIndex: number; id: string; patch: Partial<Pick<Card, 'front' | 'back' | 'frontSrc' | 'backSrc' | 'frontState' | 'backState'>> }
  | { type: 'SET_SHARED_BACK'; deckIndex: number; dataUrl: string | null }
  | { type: 'CLEAR_DECK'; deckIndex: number }
  | { type: 'MOVE_CARD'; fromDeck: number; toDeck: number; cardId: string }
  | { type: 'HYDRATE'; project: Project }

function updateDeck(decks: Deck[], index: number, updater: (d: Deck) => Deck): Deck[] {
  return decks.map((d, i) => i === index ? updater(d) : d)
}

function projectReducer(project: Project, action: Action): Project {
  const nUp = project.preset.nUp

  switch (action.type) {
    case 'SET_PRESET': {
      const newNUp = action.preset.nUp
      type Entry = { card: Card; copies: number; sharedBack: string | null }
      const flat: Entry[] = []
      for (const deck of project.decks) {
        for (const card of deck.cards) {
          flat.push({
            card,
            copies: Math.min(deck.copies[card.id] ?? 1, newNUp),
            sharedBack: deck.sharedBack,
          })
        }
      }
      const newDecks: Deck[] = []
      let cur: Deck = { cards: [], copies: {}, sharedBack: flat[0]?.sharedBack ?? null }
      for (const { card, copies, sharedBack } of flat) {
        if (deckTotal(cur) + copies > newNUp && cur.cards.length > 0) {
          newDecks.push(cur)
          cur = { cards: [], copies: {}, sharedBack }
        }
        cur.cards.push(card)
        cur.copies[card.id] = copies
      }
      newDecks.push(cur)
      return { preset: action.preset, decks: newDecks.length > 0 ? newDecks : [createDeck()] }
    }

    case 'ADD_DECK':
      return { ...project, decks: [...project.decks, createDeck()] }

    case 'REMOVE_DECK': {
      if (project.decks.length <= 1) return project
      return { ...project, decks: project.decks.filter((_, i) => i !== action.deckIndex) }
    }

    case 'ADD_CARD': {
      const deck = project.decks[action.deckIndex]
      if (!deck || deckTotal(deck) >= nUp) return project
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, d => ({
          ...d,
          cards: [...d.cards, action.card],
          copies: { ...d.copies, [action.card.id]: 1 },
        })),
      }
    }

    case 'REMOVE_CARD': {
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, d => {
          const copies = { ...d.copies }
          delete copies[action.id]
          return { ...d, cards: d.cards.filter(c => c.id !== action.id), copies }
        }),
      }
    }

    case 'SET_COPIES': {
      if (action.count < 1) return project
      const deck = project.decks[action.deckIndex]
      if (!deck) return project
      const current = deck.copies[action.id] ?? 1
      const newTotal = deckTotal(deck) - current + action.count
      if (newTotal > nUp) return project
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, d => ({
          ...d,
          copies: { ...d.copies, [action.id]: action.count },
        })),
      }
    }

    case 'UPDATE_CARD':
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, d => ({
          ...d,
          cards: d.cards.map(c => c.id === action.id ? { ...c, ...action.patch } : c),
        })),
      }

    case 'SET_SHARED_BACK':
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, d => ({ ...d, sharedBack: action.dataUrl })),
      }

    case 'CLEAR_DECK':
      return {
        ...project,
        decks: updateDeck(project.decks, action.deckIndex, () => createDeck()),
      }

    case 'MOVE_CARD': {
      const src = project.decks[action.fromDeck]
      const dst = project.decks[action.toDeck]
      if (!src || !dst || action.fromDeck === action.toDeck) return project
      const card = src.cards.find(c => c.id === action.cardId)
      if (!card || deckTotal(dst) >= nUp) return project
      const srcCopies = { ...src.copies }
      delete srcCopies[card.id]
      const newDecks = project.decks.map((d, i) => {
        if (i === action.fromDeck) return { ...d, cards: d.cards.filter(c => c.id !== action.cardId), copies: srcCopies }
        if (i === action.toDeck) return { ...d, cards: [...d.cards, card], copies: { ...d.copies, [card.id]: 1 } }
        return d
      })
      return { ...project, decks: newDecks }
    }

    case 'HYDRATE':
      return action.project

    case 'RESET':
      return createProject()

    default:
      return project
  }
}

// Guard against stale or partial data from an older build.
function normalizeProject(parsed: Partial<Project> | null | undefined): Project {
  const preset = PRESETS[parsed?.preset?.id as PrintPreset['id']] ?? DEFAULT_PRESET
  const decks = parsed?.decks?.length ? parsed.decks : [createDeck()]
  return { preset, decks }
}

// Projects written before IndexedDB lived in localStorage under STORAGE_KEY
// (multi-deck) or LEGACY_KEY (single deck). Read them once, then remove them.
function readLegacyLocalStorage(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeProject(JSON.parse(raw) as Project)
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const deck = { ...createDeck(), ...JSON.parse(legacy) } as Deck
      return { preset: DEFAULT_PRESET, decks: [deck] }
    }
  } catch { /* storage unavailable or corrupt */ }
  return null
}

function clearLegacyLocalStorage() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key)
  } catch { /* ignore */ }
}

async function loadProject(): Promise<Project | null> {
  let stored: Project | null
  try {
    stored = await readStoredProject()
  } catch {
    // IndexedDB unavailable (private mode, storage disabled): fall back to
    // whatever localStorage has, without migrating it.
    return readLegacyLocalStorage()
  }
  if (stored) return normalizeProject(stored)

  const legacy = readLegacyLocalStorage()
  if (legacy) {
    try {
      await writeStoredProject(legacy)
      clearLegacyLocalStorage()
    } catch { /* keep the localStorage copy if the migration write fails */ }
  }
  return legacy
}

// Blob URLs (frontSrc/backSrc) are session-only and never persisted.
function toSerializable(project: Project): Project {
  return {
    ...project,
    decks: project.decks.map(deck => ({
      ...deck,
      cards: deck.cards.map(card => {
        const { frontSrc, backSrc, ...rest } = card
        void frontSrc; void backSrc
        return rest
      }),
    })),
  }
}

export function useProject() {
  const [project, dispatch] = useReducer(projectReducer, undefined, createProject)
  const [hydrated, setHydrated] = useState(false)
  const [storageWriteError, setStorageWriteError] = useState<string | null>(null)
  const hasShownStorageError = useRef(false)

  // Load once on mount. Nothing is written until this has resolved, so the
  // empty initial state can never overwrite a saved project.
  useEffect(() => {
    let cancelled = false
    loadProject()
      .then(saved => {
        if (cancelled) return
        if (saved) dispatch({ type: 'HYDRATE', project: saved })
      })
      .finally(() => { if (!cancelled) setHydrated(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeStoredProject(toSerializable(project)).catch(() => {
      if (!hasShownStorageError.current) {
        hasShownStorageError.current = true
        setStorageWriteError("Couldn't save — storage may be full or unavailable. Export your PDF to avoid losing work.")
      }
    })
  }, [project, hydrated])

  function revokeCard(card: Card) {
    if (card.frontSrc?.startsWith('blob:')) URL.revokeObjectURL(card.frontSrc)
    if (card.backSrc?.startsWith('blob:')) URL.revokeObjectURL(card.backSrc)
  }

  return {
    project,
    hydrated,
    storageWriteError,

    setPreset: (preset: PrintPreset) => dispatch({ type: 'SET_PRESET', preset }),

    addDeck: () => dispatch({ type: 'ADD_DECK' }),

    removeDeck: (deckIndex: number) => {
      const deck = project.decks[deckIndex]
      if (deck) deck.cards.forEach(revokeCard)
      dispatch({ type: 'REMOVE_DECK', deckIndex })
    },

    addCard: (deckIndex: number, card: Card) =>
      dispatch({ type: 'ADD_CARD', deckIndex, card }),

    removeCard: (deckIndex: number, id: string) => {
      const card = project.decks[deckIndex]?.cards.find(c => c.id === id)
      if (card) revokeCard(card)
      dispatch({ type: 'REMOVE_CARD', deckIndex, id })
    },

    setCopies: (deckIndex: number, id: string, count: number) =>
      dispatch({ type: 'SET_COPIES', deckIndex, id, count }),

    updateCard: (deckIndex: number, id: string, patch: Partial<Pick<Card, 'front' | 'back' | 'frontSrc' | 'backSrc' | 'frontState' | 'backState'>>) =>
      dispatch({ type: 'UPDATE_CARD', deckIndex, id, patch }),

    setSharedBack: (deckIndex: number, dataUrl: string | null) =>
      dispatch({ type: 'SET_SHARED_BACK', deckIndex, dataUrl }),

    clearDeck: (deckIndex: number) => {
      const deck = project.decks[deckIndex]
      if (deck) deck.cards.forEach(revokeCard)
      dispatch({ type: 'CLEAR_DECK', deckIndex })
    },

    moveCard: (fromDeck: number, toDeck: number, cardId: string) =>
      dispatch({ type: 'MOVE_CARD', fromDeck, toDeck, cardId }),

    resetProject: () => {
      project.decks.forEach(deck => deck.cards.forEach(revokeCard))
      dispatch({ type: 'RESET' })
    },
  }
}
