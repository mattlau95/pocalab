import type { PDFPage } from 'pdf-lib'
import { rgb } from 'pdf-lib'

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

export const LETTER_W = 612  // 8.5 in × 72 pt/in
export const LETTER_H = 792  // 11 in × 72 pt/in

export const BLEED_W = mmToPt(59)  // ≈ 167.24 pt
export const BLEED_H = mmToPt(89)  // ≈ 252.28 pt

const TRIM_INSET = mmToPt(2)   // (bleed − trim) / 2 per side ≈ 5.67 pt
const MARK_LEN = mmToPt(4)     // crop-mark tick length ≈ 11.34 pt

export const MARGIN_X = (LETTER_W - 3 * BLEED_W) / 2  // ≈ 55.13 pt
export const MARGIN_Y = (LETTER_H - 3 * BLEED_H) / 2  // ≈ 17.58 pt

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

export function drawCropMarks(page: PDFPage): void {
  const black = rgb(0, 0, 0)
  const gray = rgb(0.5, 0.5, 0.5)

  const solid = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black })

  const dashed = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: gray, dashArray: [4, 4] })

  const trimL = MARGIN_X + TRIM_INSET
  const trimR = MARGIN_X + 3 * BLEED_W - TRIM_INSET
  const trimB = MARGIN_Y + TRIM_INSET
  const trimT = MARGIN_Y + 3 * BLEED_H - TRIM_INSET

  // Corner marks (L-shaped, solid black)
  solid(trimL - MARK_LEN, trimB, trimL, trimB); solid(trimL, trimB - MARK_LEN, trimL, trimB)   // bottom-left
  solid(trimR, trimB, trimR + MARK_LEN, trimB); solid(trimR, trimB - MARK_LEN, trimR, trimB)   // bottom-right
  solid(trimL - MARK_LEN, trimT, trimL, trimT); solid(trimL, trimT, trimL, trimT + MARK_LEN)   // top-left
  solid(trimR, trimT, trimR + MARK_LEN, trimT); solid(trimR, trimT, trimR, trimT + MARK_LEN)   // top-right

  // Interior column cut guides — full-height dashed line + dual trim-edge ticks
  for (const xMid of [MARGIN_X + BLEED_W, MARGIN_X + 2 * BLEED_W]) {
    dashed(xMid, 0, xMid, LETTER_H)
    // Trim-edge ticks on top margin (both sides of the bleed boundary)
    solid(xMid - TRIM_INSET, trimT, xMid - TRIM_INSET, trimT + MARK_LEN)
    solid(xMid + TRIM_INSET, trimT, xMid + TRIM_INSET, trimT + MARK_LEN)
    // Trim-edge ticks on bottom margin
    solid(xMid - TRIM_INSET, trimB - MARK_LEN, xMid - TRIM_INSET, trimB)
    solid(xMid + TRIM_INSET, trimB - MARK_LEN, xMid + TRIM_INSET, trimB)
  }

  // Interior row cut guides — full-width dashed line + dual trim-edge ticks
  for (const yMid of [MARGIN_Y + BLEED_H, MARGIN_Y + 2 * BLEED_H]) {
    dashed(0, yMid, LETTER_W, yMid)
    // Trim-edge ticks on left margin
    solid(trimL - MARK_LEN, yMid - TRIM_INSET, trimL, yMid - TRIM_INSET)
    solid(trimL - MARK_LEN, yMid + TRIM_INSET, trimL, yMid + TRIM_INSET)
    // Trim-edge ticks on right margin
    solid(trimR, yMid - TRIM_INSET, trimR + MARK_LEN, yMid - TRIM_INSET)
    solid(trimR, yMid + TRIM_INSET, trimR + MARK_LEN, yMid + TRIM_INSET)
  }
}
