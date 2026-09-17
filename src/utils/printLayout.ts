import type { PrintPreset } from '../models/preset'
import { CARD_TRIM } from './dimensions'

// Sheet geometry for every preset, in millimetres from the sheet's top-left.
// Cards are trim-size rectangles; each gets preset.bleedMm of bleed on every
// side, so neighbouring cards are one gutter (two bleeds) apart.

export interface LayoutResult {
  cardW: number
  cardH: number
  gutter: number
  contentW: number
  contentH: number
  marginX: number
  marginY: number
  valid: boolean
  cards: Array<{ x: number; y: number; w: number; h: number }>
}

function cardSize(p: PrintPreset) {
  return p.orientation === 'landscape'
    ? { cardW: CARD_TRIM.heightMm, cardH: CARD_TRIM.widthMm }
    : { cardW: CARD_TRIM.widthMm, cardH: CARD_TRIM.heightMm }
}

export function layout(p: PrintPreset): LayoutResult {
  const { cardW, cardH } = cardSize(p)
  const gutter = 2 * p.bleedMm

  const contentW = p.cols * cardW + (p.cols - 1) * gutter
  const contentH = p.rows * cardH + (p.rows - 1) * gutter

  const marginX = (p.sheetMm.w - contentW) / 2
  const marginY = (p.sheetMm.h - contentH) / 2

  const valid = marginX >= p.bleedMm && marginY >= p.bleedMm

  const cards: Array<{ x: number; y: number; w: number; h: number }> = []
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      cards.push({
        x: marginX + c * (cardW + gutter),
        y: marginY + r * (cardH + gutter),
        w: cardW,
        h: cardH,
      })
    }
  }

  return { cardW, cardH, gutter, contentW, contentH, marginX, marginY, valid, cards }
}

export function maxBleed(p: PrintPreset): number {
  const { cardW, cardH } = cardSize(p)
  const bx = (p.sheetMm.w - p.cols * cardW) / (2 * p.cols)
  const by = (p.sheetMm.h - p.rows * cardH) / (2 * p.rows)
  return Math.min(bx, by)
}
