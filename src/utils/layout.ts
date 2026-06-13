import type { PDFPage } from 'pdf-lib'
import { rgb } from 'pdf-lib'

export function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

// Card dimensions (same for all paper sizes)
export const BLEED_W = mmToPt(59)  // ≈ 167.24 pt
export const BLEED_H = mmToPt(89)  // ≈ 252.28 pt

const TRIM_INSET = mmToPt(2)
const MARK_LEN = mmToPt(4)

// Paper sizes
export const LETTER_W = 612   // 8.5 in
export const LETTER_H = 792   // 11 in
export const A4_W = mmToPt(210)  // ≈ 595 pt
export const A4_H = mmToPt(297)  // ≈ 842 pt

export interface PageConfig {
  pageW: number
  pageH: number
  marginX: number
  marginY: number
}

export const LETTER_CONFIG: PageConfig = {
  pageW: LETTER_W,
  pageH: LETTER_H,
  marginX: (LETTER_W - 3 * BLEED_W) / 2,  // ≈ 55.1 pt
  marginY: (LETTER_H - 3 * BLEED_H) / 2,  // ≈ 17.6 pt
}

export const A4_CONFIG: PageConfig = {
  pageW: A4_W,
  pageH: A4_H,
  marginX: (A4_W - 3 * BLEED_W) / 2,  // ≈ 46.6 pt
  marginY: (A4_H - 3 * BLEED_H) / 2,  // ≈ 42.6 pt
}

// Backwards-compatible named exports
export const MARGIN_X = LETTER_CONFIG.marginX
export const MARGIN_Y = LETTER_CONFIG.marginY

// 9 slot origins [x, y] in pdf-lib pt (origin = bottom-left).
// Slots are row-major: slot 0 = top-left visual (highest y).
export function computeFrontSlots(cfg: PageConfig = LETTER_CONFIG): [number, number][] {
  const slots: [number, number][] = []
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      slots.push([
        cfg.marginX + col * BLEED_W,
        cfg.marginY + (2 - row) * BLEED_H,
      ])
    }
  }
  return slots
}

// Long-edge duplex mirrors columns: x_back = pageWidth − x_front − bleedW.
export function computeBackSlots(cfg: PageConfig = LETTER_CONFIG): [number, number][] {
  return computeFrontSlots(cfg).map(([x, y]) => [cfg.pageW - x - BLEED_W, y])
}

export function drawCropMarks(page: PDFPage, cfg: PageConfig = LETTER_CONFIG): void {
  const black = rgb(0, 0, 0)
  const trimGray = rgb(0.55, 0.55, 0.55)

  const cornerMark = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black })

  const trimLine = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: trimGray })

  const trimL = cfg.marginX + TRIM_INSET
  const trimR = cfg.marginX + 3 * BLEED_W - TRIM_INSET
  const trimB = cfg.marginY + TRIM_INSET
  const trimT = cfg.marginY + 3 * BLEED_H - TRIM_INSET

  // Corner marks (L-shaped, solid black) at outer trim corners
  cornerMark(trimL - MARK_LEN, trimB, trimL, trimB); cornerMark(trimL, trimB - MARK_LEN, trimL, trimB)
  cornerMark(trimR, trimB, trimR + MARK_LEN, trimB); cornerMark(trimR, trimB - MARK_LEN, trimR, trimB)
  cornerMark(trimL - MARK_LEN, trimT, trimL, trimT); cornerMark(trimL, trimT, trimL, trimT + MARK_LEN)
  cornerMark(trimR, trimT, trimR + MARK_LEN, trimT); cornerMark(trimR, trimT, trimR, trimT + MARK_LEN)

  // Outer trim lines — full page span
  trimLine(trimL, 0, trimL, cfg.pageH)
  trimLine(trimR, 0, trimR, cfg.pageH)
  trimLine(0, trimB, cfg.pageW, trimB)
  trimLine(0, trimT, cfg.pageW, trimT)

  // Interior column trim pairs
  for (const xMid of [cfg.marginX + BLEED_W, cfg.marginX + 2 * BLEED_W]) {
    trimLine(xMid - TRIM_INSET, 0, xMid - TRIM_INSET, cfg.pageH)
    trimLine(xMid + TRIM_INSET, 0, xMid + TRIM_INSET, cfg.pageH)
  }

  // Interior row trim pairs
  for (const yMid of [cfg.marginY + BLEED_H, cfg.marginY + 2 * BLEED_H]) {
    trimLine(0, yMid - TRIM_INSET, cfg.pageW, yMid - TRIM_INSET)
    trimLine(0, yMid + TRIM_INSET, cfg.pageW, yMid + TRIM_INSET)
  }
}
