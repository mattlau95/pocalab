export interface CropState {
  crop: { x: number; y: number }
  zoom: number
  rotation: number
  bgColor: string
}

export interface Card {
  id: string
  front: string | null
  back: string | null
  frontSrc?: string    // original upload blob URL — session-only, not persisted
  backSrc?: string     // original upload blob URL — session-only, not persisted
  frontState?: CropState
  backState?: CropState
}

export function createCard(): Card {
  return { id: crypto.randomUUID(), front: null, back: null }
}
