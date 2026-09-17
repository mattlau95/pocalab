import type { Deck } from '../models/deck'
import type { PrintPreset } from '../models/preset'

// What lands in each slot of a printed sheet. The sheet preview and the PDF
// builder both read this, so what you preview is what prints.

export type SheetSlot = { front: string | null; back: string | null }

export function isPhotoPaper(preset: PrintPreset): boolean {
  return preset.id !== 'letter' && preset.id !== 'a4'
}

// Each card repeated by its copy count, with the deck's shared back filled in.
export function expandDeck(deck: Deck): SheetSlot[] {
  const slots: SheetSlot[] = []
  for (const card of deck.cards) {
    const count = deck.copies[card.id] ?? 1
    for (let i = 0; i < count; i++) slots.push({ front: card.front, back: card.back ?? deck.sharedBack })
  }
  return slots
}

// Letter/A4 repeat each card by its copy count. Photo paper hides the copies
// control and prints each card once, even if a count carried over from Letter.
export function printedSlots(deck: Deck, preset: PrintPreset): SheetSlot[] {
  const slots = isPhotoPaper(preset)
    ? deck.cards.map(card => ({ front: card.front, back: card.back ?? deck.sharedBack }))
    : expandDeck(deck)
  return slots.slice(0, preset.nUp)
}
