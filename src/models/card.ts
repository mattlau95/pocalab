export interface Card {
  id: string
  front: string | null
  back: string | null
  frontSrc?: string  // original upload blob URL — session-only, not persisted
  backSrc?: string   // original upload blob URL — session-only, not persisted
}

export function createCard(): Card {
  return { id: crypto.randomUUID(), front: null, back: null }
}
