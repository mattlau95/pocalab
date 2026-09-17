import { PDFDocument, StandardFonts, rgb, degrees, type PDFPage, type PDFFont } from 'pdf-lib'
import type { PrintPreset } from '../models/preset'
import { layout, type LayoutResult } from './printLayout'
import { isPhotoPaper, type SheetSlot } from './sheetSlots'
import { MM_TO_PT, mmToPt } from './units'

// The PDF pipeline for every paper size. Page one is the fronts; page two is
// the backs, mirrored across the sheet for a long-edge duplex flip. Letter and
// A4 add full-page trim guides and orientation labels; photo paper gets corner
// ticks only.

export type PdfProgress = (done: number, total: number) => void

// A rectangle in PDF points, origin bottom-left.
type Box = { x: number; y: number; w: number; h: number }

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Image embedding never yields to the event loop on its own, so without a
// pause React can't render progress until the whole PDF is built.
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// Converts a millimetre rectangle measured from the sheet's top-left into PDF points.
function toPdfBox(sheetH: number, x: number, y: number, w: number, h: number): Box {
  return { x: x * MM_TO_PT, y: (sheetH - y - h) * MM_TO_PT, w: w * MM_TO_PT, h: h * MM_TO_PT }
}

function slotGeometry(preset: PrintPreset, L: LayoutResult) {
  const b = preset.bleedMm
  const { w: sheetW, h: sheetH } = preset.sheetMm
  // Long-edge duplex mirrors each card across the vertical centre line.
  const mirrored = L.cards.map(c => ({ ...c, x: sheetW - c.x - c.w }))
  const bleedBox = (c: LayoutResult['cards'][number]) => toPdfBox(sheetH, c.x - b, c.y - b, c.w + 2 * b, c.h + 2 * b)
  return {
    frontBleed: L.cards.map(bleedBox),
    backBleed: mirrored.map(bleedBox),
    frontTrim: L.cards,
    backTrim: mirrored,
  }
}

// Photo paper: eight short ticks just outside each card's trim corners.
function drawCornerTicks(page: PDFPage, trims: LayoutResult['cards'], pageH: number) {
  const tickLen = mmToPt(3)
  const tickOffset = mmToPt(1)
  const black = rgb(0, 0, 0)

  function tick(cx: number, cy: number, dx: number, dy: number) {
    page.drawLine({
      start: { x: cx + dx * tickOffset,            y: cy + dy * tickOffset },
      end:   { x: cx + dx * (tickOffset + tickLen), y: cy + dy * (tickOffset + tickLen) },
      thickness: 0.25,
      color: black,
    })
  }

  for (const card of trims) {
    const left  = card.x * MM_TO_PT
    const right = (card.x + card.w) * MM_TO_PT
    const topY  = pageH - card.y * MM_TO_PT
    const botY  = pageH - (card.y + card.h) * MM_TO_PT
    tick(left, topY, -1, 0);  tick(left, topY, 0, 1)
    tick(right, topY, 1, 0);  tick(right, topY, 0, 1)
    tick(left, botY, -1, 0);  tick(left, botY, 0, -1)
    tick(right, botY, 1, 0);  tick(right, botY, 0, -1)
  }
}

// Letter/A4: the cards' bleed boxes touch, so the sheet is one grid.
type Grid = { left: number; bottom: number; cellW: number; cellH: number; cols: number; rows: number; inset: number }

function gridOf(preset: PrintPreset, frontBleed: Box[]): Grid {
  const first = frontBleed[0]
  const last = frontBleed[frontBleed.length - 1]
  return {
    left: first.x,
    bottom: last.y,
    cellW: first.w,
    cellH: first.h,
    cols: preset.cols,
    rows: preset.rows,
    inset: mmToPt(preset.bleedMm),
  }
}

// Letter/A4: L-shaped corner marks at the grid's outer trim corners, and
// full-page trim lines along every cut.
function drawTrimGuides(page: PDFPage, g: Grid) {
  const { width: pageW, height: pageH } = page.getSize()
  const black = rgb(0, 0, 0)
  const trimGray = rgb(0.55, 0.55, 0.55)
  const markLen = mmToPt(4)

  const cornerMark = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black })
  const trimLine = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: trimGray })

  const trimL = g.left + g.inset
  const trimR = g.left + g.cols * g.cellW - g.inset
  const trimB = g.bottom + g.inset
  const trimT = g.bottom + g.rows * g.cellH - g.inset

  cornerMark(trimL - markLen, trimB, trimL, trimB); cornerMark(trimL, trimB - markLen, trimL, trimB)
  cornerMark(trimR, trimB, trimR + markLen, trimB); cornerMark(trimR, trimB - markLen, trimR, trimB)
  cornerMark(trimL - markLen, trimT, trimL, trimT); cornerMark(trimL, trimT, trimL, trimT + markLen)
  cornerMark(trimR, trimT, trimR + markLen, trimT); cornerMark(trimR, trimT, trimR, trimT + markLen)

  trimLine(trimL, 0, trimL, pageH)
  trimLine(trimR, 0, trimR, pageH)
  trimLine(0, trimB, pageW, trimB)
  trimLine(0, trimT, pageW, trimT)

  for (let c = 1; c < g.cols; c++) {
    const xMid = g.left + c * g.cellW
    trimLine(xMid - g.inset, 0, xMid - g.inset, pageH)
    trimLine(xMid + g.inset, 0, xMid + g.inset, pageH)
  }
  for (let r = 1; r < g.rows; r++) {
    const yMid = g.bottom + r * g.cellH
    trimLine(0, yMid - g.inset, pageW, yMid - g.inset)
    trimLine(0, yMid + g.inset, pageW, yMid + g.inset)
  }
}

// Letter/A4: "TOP" labels on both pages and the flip direction on the front.
function drawOrientationLabels(front: PDFPage, back: PDFPage, g: Grid, font: PDFFont) {
  const gray = rgb(0.5, 0.5, 0.5)
  const gridTop = g.bottom + g.rows * g.cellH
  const gridRight = g.left + g.cols * g.cellW
  const topLabel = 'TOP ^'
  const topLabelW = font.widthOfTextAtSize(topLabel, 7)
  const sideLabel = 'TOP >'
  const sideLabelW = font.widthOfTextAtSize(sideLabel, 7)

  const leftMarginX = g.left - mmToPt(3)
  const rightMarginX = gridRight + mmToPt(4)
  const sideTopY = gridTop - mmToPt(2) - mmToPt(3) - sideLabelW

  for (const page of [front, back]) {
    page.drawText(topLabel, {
      x: (page.getWidth() - topLabelW) / 2,
      y: gridTop + mmToPt(2),
      size: 7, font, color: gray,
    })
    page.drawText(sideLabel, {
      x: leftMarginX, y: sideTopY,
      size: 7, font, color: gray, rotate: degrees(90),
    })
    page.drawText(sideLabel, {
      x: rightMarginX, y: sideTopY,
      size: 7, font, color: gray, rotate: degrees(90),
    })
  }

  front.drawText('flip long edge ->', {
    x: gridRight + mmToPt(4),
    y: front.getHeight() / 2,
    size: 7, font, color: gray, rotate: degrees(90),
  })
}

// Builds the two-page PDF for one sheet. `slots` should come from printedSlots.
export async function buildSheetPdf(preset: PrintPreset, slots: SheetSlot[], onProgress?: PdfProgress): Promise<Uint8Array> {
  const L = layout(preset)
  const { frontBleed, backBleed, frontTrim, backTrim } = slotGeometry(preset, L)
  const pageW = preset.sheetMm.w * MM_TO_PT
  const pageH = preset.sheetMm.h * MM_TO_PT
  const guides = !isPhotoPaper(preset)

  const doc = await PDFDocument.create()
  const font = guides ? await doc.embedFont(StandardFonts.Helvetica) : null
  const frontPage = doc.addPage([pageW, pageH])
  const backPage = doc.addPage([pageW, pageH])
  const grid = guides ? gridOf(preset, frontBleed) : null

  // Back trim guides go down before the images so the photos cover them on the
  // printed side; front guides stay on top as a continuous ruler.
  if (grid) drawTrimGuides(backPage, grid)

  const total = Math.min(slots.length, L.cards.length)
  onProgress?.(0, total)
  for (let i = 0; i < total; i++) {
    const { front, back } = slots[i]
    if (front) {
      const img = await doc.embedPng(dataUrlToBytes(front))
      const box = frontBleed[i]
      frontPage.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h })
    }
    if (back) {
      const img = await doc.embedPng(dataUrlToBytes(back))
      const box = backBleed[i]
      backPage.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h })
    }
    onProgress?.(i + 1, total)
    if (onProgress) await yieldToBrowser()
  }

  if (grid && font) {
    drawTrimGuides(frontPage, grid)
    drawOrientationLabels(frontPage, backPage, grid, font)
  } else {
    drawCornerTicks(frontPage, frontTrim, pageH)
    drawCornerTicks(backPage, backTrim, pageH)
  }

  return doc.save()
}

// Several sheets in one PDF, in order, two pages per sheet. Progress counts
// slots across all sheets.
export async function buildSheetsPdf(preset: PrintPreset, sheets: SheetSlot[][], onProgress?: PdfProgress): Promise<Uint8Array> {
  const combined = await PDFDocument.create()
  const total = sheets.reduce((n, s) => n + Math.min(s.length, preset.nUp), 0)
  let offset = 0
  for (const slots of sheets) {
    const bytes = await buildSheetPdf(preset, slots, onProgress && (done => onProgress(offset + done, total)))
    offset += Math.min(slots.length, preset.nUp)
    const sheetDoc = await PDFDocument.load(bytes)
    const pages = await combined.copyPages(sheetDoc, sheetDoc.getPageIndices())
    pages.forEach(p => combined.addPage(p))
  }
  return combined.save()
}
