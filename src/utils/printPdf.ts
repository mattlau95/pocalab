import { PDFDocument, rgb } from 'pdf-lib'
import type { PDFPage } from 'pdf-lib'
import { layout, MM_TO_PT } from './printLayout'
import { mmToPt } from './layout'
import type { PrintPreset } from '../models/preset'
import type { Deck } from '../models/deck'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function drawPrintCropMarks(
  page: PDFPage,
  cards: Array<{ x: number; y: number; w: number; h: number }>,
  pageH: number,
): void {
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

  for (const card of cards) {
    const left   = card.x * MM_TO_PT
    const right  = (card.x + card.w) * MM_TO_PT
    const topY   = pageH - card.y * MM_TO_PT           // pdf y-up: top of card
    const botY   = pageH - (card.y + card.h) * MM_TO_PT  // pdf y-up: bottom of card

    // Top-left corner: tick left + tick up
    tick(left, topY, -1,  0)
    tick(left, topY,  0,  1)
    // Top-right corner: tick right + tick up
    tick(right, topY,  1,  0)
    tick(right, topY,  0,  1)
    // Bottom-left corner: tick left + tick down
    tick(left, botY, -1,  0)
    tick(left, botY,  0, -1)
    // Bottom-right corner: tick right + tick down
    tick(right, botY,  1,  0)
    tick(right, botY,  0, -1)
  }
}

export async function buildPrintPdf(preset: PrintPreset, deck: Deck): Promise<Uint8Array> {
  const L = layout(preset)
  const b = preset.bleedMm
  const pageW = preset.sheetMm.w * MM_TO_PT
  const pageH = preset.sheetMm.h * MM_TO_PT

  const doc = await PDFDocument.create()
  const frontPage = doc.addPage([pageW, pageH])
  const backPage  = doc.addPage([pageW, pageH])

  const slots = L.cards
  const cards = deck.cards.slice(0, preset.nUp)

  // Mirror slot x-positions for long-edge duplex back
  const backSlots = slots.map(s => ({ ...s, x: preset.sheetMm.w - s.x - s.w }))

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]
    const fs = slots[i]
    const bs = backSlots[i]

    // Bleed rect dimensions in pt
    const imgW = (fs.w + 2 * b) * MM_TO_PT
    const imgH = (fs.h + 2 * b) * MM_TO_PT

    // Front: top-left of bleed rect in pdf y-up coords
    const frontImgX = (fs.x - b) * MM_TO_PT
    const frontImgY = pageH - (fs.y - b + fs.h + 2 * b) * MM_TO_PT

    // Back: mirrored x
    const backImgX = (bs.x - b) * MM_TO_PT
    const backImgY = pageH - (bs.y - b + bs.h + 2 * b) * MM_TO_PT

    if (card.front) {
      try {
        const img = await doc.embedPng(dataUrlToBytes(card.front))
        frontPage.drawImage(img, { x: frontImgX, y: frontImgY, width: imgW, height: imgH })
      } catch { /* skip unparseable image */ }
    }

    const backDataUrl = card.back ?? deck.sharedBack
    if (backDataUrl) {
      try {
        const img = await doc.embedPng(dataUrlToBytes(backDataUrl))
        backPage.drawImage(img, { x: backImgX, y: backImgY, width: imgW, height: imgH })
      } catch { /* skip unparseable image */ }
    }
  }

  drawPrintCropMarks(frontPage, slots, pageH)
  drawPrintCropMarks(backPage, backSlots, pageH)

  return doc.save()
}
