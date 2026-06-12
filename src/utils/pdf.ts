import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import {
  computeFrontSlots, computeBackSlots, drawCropMarks,
  BLEED_W, BLEED_H, LETTER_W, LETTER_H, MARGIN_X, MARGIN_Y, mmToPt,
} from './layout'

export type PdfSlot = { front: string | null; back: string | null }

type Calibration = { theta: number; dx: number; dy: number }

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function readCalibration(): Calibration {
  try {
    const raw = localStorage.getItem('photocard-calibration')
    if (raw) return JSON.parse(raw) as Calibration
  } catch { /* ignore */ }
  return { theta: 0, dx: 0, dy: 0 }
}

export async function createPhotocardPdf(slots: PdfSlot[]): Promise<Uint8Array> {
  const cal = readCalibration()
  const doc = await PDFDocument.create()
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const frontPage = doc.addPage([LETTER_W, LETTER_H])
  const backPage = doc.addPage([LETTER_W, LETTER_H])

  const frontSlots = computeFrontSlots()
  const backSlots = computeBackSlots()
  const gray = rgb(0.5, 0.5, 0.5)

  for (let i = 0; i < Math.min(slots.length, 9); i++) {
    const { front, back } = slots[i]

    if (front) {
      const img = await doc.embedPng(dataUrlToBytes(front))
      frontPage.drawImage(img, { x: frontSlots[i][0], y: frontSlots[i][1], width: BLEED_W, height: BLEED_H })
    }

    if (back) {
      const img = await doc.embedPng(dataUrlToBytes(back))
      backPage.drawImage(img, {
        x: backSlots[i][0] + cal.dx,
        y: backSlots[i][1] + cal.dy,
        width: BLEED_W,
        height: BLEED_H,
        rotate: degrees(cal.theta),
      })
    }
  }

  drawCropMarks(frontPage)
  drawCropMarks(backPage)

  // Orientation labels
  const gridTop = MARGIN_Y + 3 * BLEED_H
  const topLabel = 'TOP ↑'
  const topLabelW = helvetica.widthOfTextAtSize(topLabel, 7)

  for (const page of [frontPage, backPage]) {
    page.drawText(topLabel, {
      x: (LETTER_W - topLabelW) / 2,
      y: gridTop + mmToPt(2),
      size: 7,
      font: helvetica,
      color: gray,
    })
  }

  // "flip long edge →" on right margin of front page, reading bottom-to-top
  frontPage.drawText('flip long edge →', {
    x: MARGIN_X + 3 * BLEED_W + mmToPt(4),
    y: LETTER_H / 2,
    size: 7,
    font: helvetica,
    color: gray,
    rotate: degrees(90),
  })

  return doc.save()
}
