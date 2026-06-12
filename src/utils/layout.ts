import type { PDFPage } from 'pdf-lib'
import { rgb } from 'pdf-lib'

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

const LETTER_W = 612  // 8.5 in × 72 pt/in
const LETTER_H = 792  // 11 in × 72 pt/in

export const BLEED_W = mmToPt(59)  // ≈ 167.24 pt
export const BLEED_H = mmToPt(89)  // ≈ 252.28 pt

const TRIM_INSET = mmToPt(2)   // (bleed − trim) / 2 per side ≈ 5.67 pt
const MARK_LEN = mmToPt(4)     // crop-mark tick length ≈ 11.34 pt

const MARGIN_X = (LETTER_W - 3 * BLEED_W) / 2  // ≈ 55.13 pt
const MARGIN_Y = (LETTER_H - 3 * BLEED_H) / 2  // ≈ 17.58 pt

// 9 slot origins [x, y] in pdf-lib pt (origin = bottom-left).
// Slots are row-major: slot 0 = top-left visual (highest y).
export function computeFrontSlots(): [number, number][] {
  const slots: [number, number][] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      slots.push([
        MARGIN_X + col * BLEED_W,
        MARGIN_Y + (2 - row) * BLEED_H,
      ])
    }
  }
  return slots
}

// Long-edge duplex mirrors columns: x_back = pageWidth − x_front − bleedW.
export function computeBackSlots(): [number, number][] {
  return computeFrontSlots().map(([x, y]) => [LETTER_W - x - BLEED_W, y])
}

// Draws 16 crop-mark ticks: 4 L-shaped corner marks + 2 interior ticks per side.
export function drawCropMarks(page: PDFPage): void {
  const black = rgb(0, 0, 0)

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black })

  const trimL = MARGIN_X + TRIM_INSET
  const trimR = MARGIN_X + 3 * BLEED_W - TRIM_INSET
  const trimB = MARGIN_Y + TRIM_INSET
  const trimT = MARGIN_Y + 3 * BLEED_H - TRIM_INSET

  // Corner marks (L-shaped)
  line(trimL - MARK_LEN, trimB, trimL, trimB); line(trimL, trimB - MARK_LEN, trimL, trimB)   // bottom-left
  line(trimR, trimB, trimR + MARK_LEN, trimB); line(trimR, trimB - MARK_LEN, trimR, trimB)   // bottom-right
  line(trimL - MARK_LEN, trimT, trimL, trimT); line(trimL, trimT, trimL, trimT + MARK_LEN)   // top-left
  line(trimR, trimT, trimR + MARK_LEN, trimT); line(trimR, trimT, trimR, trimT + MARK_LEN)   // top-right

  // Interior column boundaries — tick marks on top and bottom edges
  for (const xMid of [MARGIN_X + BLEED_W, MARGIN_X + 2 * BLEED_W]) {
    line(xMid, trimT, xMid, trimT + MARK_LEN)
    line(xMid, trimB - MARK_LEN, xMid, trimB)
  }

  // Interior row boundaries — tick marks on left and right edges
  for (const yMid of [MARGIN_Y + BLEED_H, MARGIN_Y + 2 * BLEED_H]) {
    line(trimL - MARK_LEN, yMid, trimL, yMid)
    line(trimR, yMid, trimR + MARK_LEN, yMid)
  }
}
