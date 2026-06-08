export interface Card {
  id: string
  front: string | null
  back: string | null
}

export function createCard(): Card {
  return { id: crypto.randomUUID(), front: null, back: null }
}
