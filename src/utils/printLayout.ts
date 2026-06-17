import type { PrintPreset } from '../models/preset'

export const MM_TO_PT = 72 / 25.4

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

export function layout(p: PrintPreset): LayoutResult {
  const cardW = p.orientation === 'landscape' ? 85 : 55
  const cardH = p.orientation === 'landscape' ? 55 : 85
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
  const cardW = p.orientation === 'landscape' ? 85 : 55
  const cardH = p.orientation === 'landscape' ? 55 : 85
  const bx = (p.sheetMm.w - p.cols * cardW) / (2 * p.cols)
  const by = (p.sheetMm.h - p.rows * cardH) / (2 * p.rows)
  return Math.min(bx, by)
}
